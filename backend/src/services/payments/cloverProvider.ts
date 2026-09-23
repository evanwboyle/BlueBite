import {
  CloverConnector,
  HttpSupport,
  WebSocketCloudCloverDeviceConfigurationBuilder,
  remotepay,
} from "remote-pay-cloud";
import { XMLHttpRequest } from "xmlhttprequest";
import { NodeCloverWebSocketImpl } from "./clover/nodeWebSocket";
import { NodeImageUtil } from "./clover/nodeImageUtil";
import type {
  PaymentProvider,
  PaymentRequestParams,
  PaymentCancelParams,
  PaymentResult,
  PaymentResultHandler,
} from "./types";
import { logPaymentEvent } from "./paymentLogger";

const SANDBOX_SERVER = "https://apisandbox.dev.clover.com";
const PRODUCTION_SERVER = "https://www.clover.com";

interface CloverConfig {
  applicationId: string;
  merchantId: string;
  deviceId: string;
  accessToken: string;
  cloverServer: string;
  friendlyId: string;
  forceConnect: boolean;
  connectTimeoutMs: number;
}

function loadConfig(): CloverConfig {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const deviceId = process.env.CLOVER_DEVICE_ID;
  const accessToken = process.env.CLOVER_ACCESS_TOKEN;

  if (!merchantId || !deviceId || !accessToken) {
    throw new Error(
      "Clover payment provider is not configured. Set CLOVER_MERCHANT_ID, CLOVER_DEVICE_ID, and CLOVER_ACCESS_TOKEN " +
        "(see documentation/CLOVER_PAYMENTS.md), or set PAYMENT_PROVIDER=mock to develop without hardware."
    );
  }

  const environment = (process.env.CLOVER_ENVIRONMENT || "sandbox").toLowerCase();
  const cloverServer =
    process.env.CLOVER_SERVER_URL || (environment === "production" ? PRODUCTION_SERVER : SANDBOX_SERVER);

  return {
    applicationId: process.env.CLOVER_APP_ID || "com.bluebite.pos:1.0.0",
    merchantId,
    deviceId,
    accessToken,
    cloverServer,
    friendlyId: process.env.CLOVER_FRIENDLY_ID || "BlueBite POS",
    forceConnect: process.env.CLOVER_FORCE_CONNECT === "true",
    connectTimeoutMs: Number(process.env.CLOVER_CONNECT_TIMEOUT_MS ?? 20000),
  };
}

/**
 * Real "touch to pay" integration using Clover's official Remote Pay Cloud
 * SDK (`remote-pay-cloud`). This opens one persistent authenticated
 * connection to a cloud-paired Clover device (Flex/Mini/Station in "Cloud
 * Pay Display" mode) and pushes sale() requests to it - the device shows the
 * amount, the customer taps/inserts/swipes, and the result comes back
 * through the connector's listener. There is no public webhook: the
 * connection itself is the transport, authenticated by CLOVER_ACCESS_TOKEN.
 *
 * IMPORTANT: this has been built directly against the SDK's shipped type
 * definitions and its own Node usage guidance, but has not been exercised
 * against a real device or Clover's sandbox from this environment (no
 * network path to a paired terminal here). Validate against Clover's sandbox
 * + a real or simulated device before relying on it in production - see
 * documentation/CLOVER_PAYMENTS.md.
 */
export class CloverPaymentProvider implements PaymentProvider {
  readonly name = "clover" as const;

  private connector: InstanceType<typeof CloverConnector> | null = null;
  private readyPromise: Promise<void> | null = null;
  private onResult: PaymentResultHandler | null = null;

  // A Clover terminal can only run one transaction at a time, so a single
  // in-flight slot is sufficient and lets us correlate the async
  // onSaleResponse/onDeviceError callbacks back to our Payment row.
  private inFlight: { paymentId: string; providerRef: string } | null = null;

  setResultHandler(handler: PaymentResultHandler): void {
    this.onResult = handler;
  }

  private getConnector(): InstanceType<typeof CloverConnector> {
    if (this.connector) return this.connector;

    const config = loadConfig();
    const httpSupport = new HttpSupport(XMLHttpRequest);
    const deviceConfig = new WebSocketCloudCloverDeviceConfigurationBuilder(
      config.applicationId,
      config.deviceId,
      config.merchantId,
      config.accessToken
    )
      .setCloverServer(config.cloverServer)
      .setHttpSupport(httpSupport)
      .setWebSocketFactoryFunction(NodeCloverWebSocketImpl.createInstance)
      .setImageUtil(new NodeImageUtil())
      .setFriendlyId(config.friendlyId)
      .setForceConnect(config.forceConnect)
      .build();

    const connector = new CloverConnector(deviceConfig);
    this.connector = connector;

    let readyResolve: () => void;
    let readyReject: (err: Error) => void;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const timeout = setTimeout(() => {
      readyReject(new Error(`Timed out connecting to Clover device after ${config.connectTimeoutMs}ms`));
    }, config.connectTimeoutMs);

    const listener = new remotepay.ICloverConnectorListener();
    listener.onDeviceReady = () => {
      clearTimeout(timeout);
      readyResolve();
      logPaymentEvent({ paymentId: "system", type: "clover_device_ready", actor: "device" });
    };
    listener.onDeviceDisconnected = () => {
      logPaymentEvent({ paymentId: "system", type: "clover_device_disconnected", actor: "device" });
      // Force a fresh connect() + readiness wait on the next request.
      this.connector = null;
      this.readyPromise = null;
      if (this.inFlight) {
        const { paymentId } = this.inFlight;
        this.inFlight = null;
        this.onResult?.(paymentId, { status: "error", errorMessage: "Device disconnected mid-transaction" });
      }
    };
    listener.onDeviceError = (event: remotepay.CloverDeviceErrorEvent) => {
      const message = event?.getMessage ? event.getMessage() : "Unknown device error";
      logPaymentEvent({ paymentId: this.inFlight?.paymentId ?? "system", type: "clover_device_error", actor: "device", message });
      if (this.inFlight) {
        const { paymentId } = this.inFlight;
        this.inFlight = null;
        this.onResult?.(paymentId, { status: "error", errorMessage: message, raw: event });
      }
    };
    listener.onSaleResponse = (response: remotepay.SaleResponse) => {
      if (!this.inFlight) return;
      const { paymentId } = this.inFlight;
      this.inFlight = null;

      const success = response.getSuccess?.();
      const payment = response.getPayment?.();
      const providerRef = payment?.getId?.() ?? undefined;
      const errorMessage = response.getReason?.() || response.getMessage?.() || "Payment declined";

      logPaymentEvent({
        paymentId,
        type: "clover_sale_response",
        actor: "device",
        message: success ? "Sale approved" : errorMessage,
      });

      const result: PaymentResult = success
        ? { status: "succeeded", providerRef }
        : { status: "failed", providerRef, errorMessage };
      this.onResult?.(paymentId, result);
    };
    listener.onVoidPaymentResponse = (response: remotepay.VoidPaymentResponse) => {
      logPaymentEvent({
        paymentId: "system",
        type: "clover_void_response",
        actor: "device",
        message: response.getSuccess?.() ? "Void confirmed" : "Void failed",
      });
    };
    listener.onConfirmPaymentRequest = (request: remotepay.ConfirmPaymentRequest) => {
      // Duplicate-payment / offline-payment style confirmations. We never want a
      // payment to auto-proceed unattended in a state we haven't reviewed, so we
      // explicitly reject rather than silently accept.
      const challenge = request.getChallenges()?.[0];
      this.connector?.rejectPayment(request.getPayment(), challenge);
    };

    connector.addCloverConnectorListener(listener);
    connector.initializeConnection();

    return connector;
  }

  private async waitUntilReady(): Promise<void> {
    this.getConnector();
    await this.readyPromise;
  }

  async requestPayment(params: PaymentRequestParams): Promise<PaymentResult> {
    try {
      await this.waitUntilReady();
    } catch (err) {
      return { status: "error", errorMessage: err instanceof Error ? err.message : "Failed to connect to device" };
    }

    if (this.inFlight) {
      return { status: "error", errorMessage: "A payment is already in progress on this device" };
    }

    const providerRef = params.paymentId;
    this.inFlight = { paymentId: params.paymentId, providerRef };

    const saleRequest = new remotepay.SaleRequest();
    saleRequest.setExternalId(params.paymentId);
    saleRequest.setExternalReferenceId(params.orderId);
    // Clover amounts are integer cents.
    saleRequest.setAmount(Math.round(params.amount * 100));
    saleRequest.setAutoAcceptSignature(true);
    saleRequest.setDisablePrinting(true);

    await logPaymentEvent({
      paymentId: params.paymentId,
      type: "device_request_sent",
      actor: "system",
      message: `Sale request sent to Clover device for $${params.amount.toFixed(2)}`,
    });

    try {
      this.connector!.sale(saleRequest);
    } catch (err) {
      this.inFlight = null;
      return { status: "error", errorMessage: err instanceof Error ? err.message : "Failed to send sale request" };
    }

    return { status: "awaiting_device", providerRef };
  }

  async cancelPayment(params: PaymentCancelParams): Promise<PaymentResult> {
    if (!this.connector || !this.inFlight || this.inFlight.paymentId !== params.paymentId) {
      // Nothing in flight on the device for this payment (already resolved, or
      // requestPayment never made it to the device) - treat as already cancelled.
      return { status: "cancelled", providerRef: params.providerRef };
    }

    this.inFlight = null;
    try {
      this.connector.resetDevice();
    } catch (err) {
      console.error("[PAYMENT] Failed to reset Clover device on cancel:", err);
    }
    await logPaymentEvent({ paymentId: params.paymentId, type: "device_cancel_sent", actor: "system" });
    return { status: "cancelled", providerRef: params.providerRef };
  }
}
