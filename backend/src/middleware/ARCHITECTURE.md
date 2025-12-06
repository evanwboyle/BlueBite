# RBAC Middleware Architecture

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend (React)"
        UI[User Interface]
        Auth[Auth Context]
        API[API Client]
    end

    subgraph "Express Server"
        Session[Session Middleware]
        Passport[Passport.js CAS]

        subgraph "RBAC Middleware Layer"
            Auth1[requireAuth]
            Auth2[requireStaff/requireAdmin]
            CSRF[CSRF Protection]
            FieldVal[Field Validation]
            RateLimit[Rate Limiting]
            Audit[Audit Logger]
        end

        subgraph "Route Handlers"
            MenuRoutes[Menu Routes]
            OrderRoutes[Order Routes]
            UserRoutes[User Routes]
        end

        DB[(Database)]
    end

    UI -->|HTTP Request| API
    API -->|credentials: include| Session
    Session --> Passport
    Passport -->|req.user| Auth1
    Auth1 -->|401/next| Auth2
    Auth2 -->|403/next| CSRF
    CSRF -->|403/next| FieldVal
    FieldVal -->|400/next| RateLimit
    RateLimit -->|429/next| Audit
    Audit --> MenuRoutes
    MenuRoutes --> DB
    DB -->|Response| MenuRoutes
    MenuRoutes -->|JSON| UI
```

## Request Flow Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Session
    participant A as Auth Middleware
    participant F as Field Validation
    participant R as Rate Limiter
    participant D as Audit Logger
    participant H as Route Handler
    participant DB as Database

    C->>S: PUT /api/menu/123 (with session cookie)
    S->>A: Validate session

    alt Not authenticated
        A-->>C: 401 Unauthorized
    else Authenticated
        A->>A: Check user role

        alt Insufficient role
            A-->>C: 403 Forbidden
        else Has required role
            A->>F: Validate fields

            alt Invalid fields
                F-->>C: 400 Bad Request
            else Staff with admin fields
                F-->>C: 403 Field Authorization Error
            else Valid fields
                F->>R: Check rate limit

                alt Rate limit exceeded
                    R-->>C: 429 Too Many Requests
                else Within limit
                    R->>D: Log action
                    D->>H: Process request
                    H->>DB: Update menu item
                    DB-->>H: Updated item
                    H-->>C: 200 OK + Data
                end
            end
        end
    end
```

## Role Hierarchy

```mermaid
graph TD
    Admin[Admin]
    Staff[Staff]
    Customer[Customer]

    Admin -->|inherits| Staff
    Staff -->|inherits| Customer

    Admin -.->|Full CRUD| MenuItems[Menu Items & Modifiers]
    Staff -.->|Toggle Status| Availability[Availability & Hot Status]
    Customer -.->|Read Only| Menu[View Menu]

    style Admin fill:#ff6b6b
    style Staff fill:#4ecdc4
    style Customer fill:#95e1d3
```

## Field-Level Permissions

```mermaid
graph LR
    subgraph "Menu Item Fields"
        SA[isAvailable]
        SH[isHot]
        AN[name]
        AP[price]
        AD[description]
        AC[category]
        AI[imageUrl]
        AM[modifiers]
        ADI[dietaryInfo]
    end

    subgraph "Roles"
        Admin[Admin]
        Staff[Staff]
    end

    Admin -->|Can Modify| SA
    Admin -->|Can Modify| SH
    Admin -->|Can Modify| AN
    Admin -->|Can Modify| AP
    Admin -->|Can Modify| AD
    Admin -->|Can Modify| AC
    Admin -->|Can Modify| AI
    Admin -->|Can Modify| AM
    Admin -->|Can Modify| ADI

    Staff -->|Can Modify| SA
    Staff -->|Can Modify| SH

    Staff -.->|Cannot Modify| AN
    Staff -.->|Cannot Modify| AP
    Staff -.->|Cannot Modify| AD

    style SA fill:#90EE90
    style SH fill:#90EE90
    style AN fill:#FFB6C6
    style AP fill:#FFB6C6
    style AD fill:#FFB6C6
```

## Middleware Stack Order

```mermaid
graph TB
    Request[Incoming Request]

    Request --> M1[1. requireAuth<br/>Verify authentication]
    M1 -->|401 if not authenticated| Response401[401 Response]
    M1 -->|authenticated| M2[2. requireStaff/requireAdmin<br/>Verify role]

    M2 -->|403 if insufficient role| Response403a[403 Response]
    M2 -->|authorized| M3[3. csrfProtection<br/>Validate CSRF header]

    M3 -->|403 if missing header| Response403b[403 Response]
    M3 -->|valid| M4[4. validateMenuItemFields<br/>Check field names]

    M4 -->|400 if invalid fields| Response400[400 Response]
    M4 -->|valid| M5[5. validateMenuItemUpdate<br/>Check field permissions]

    M5 -->|403 if unauthorized fields| Response403c[403 Response]
    M5 -->|authorized| M6[6. rateLimit<br/>Check request rate]

    M6 -->|429 if exceeded| Response429[429 Response]
    M6 -->|within limit| M7[7. auditLogger<br/>Log action]

    M7 --> Handler[Route Handler]
    Handler --> DB[(Database)]
    DB --> Response200[200 Response]

    style M1 fill:#e3f2fd
    style M2 fill:#e1f5fe
    style M3 fill:#e0f7fa
    style M4 fill:#e0f2f1
    style M5 fill:#e8f5e9
    style M6 fill:#f1f8e9
    style M7 fill:#fff9c4
    style Handler fill:#fff3e0
```

## Security Layers

```mermaid
graph TB
    subgraph "Defense in Depth"
        L1[Layer 1: Session Security<br/>HttpOnly cookies, SameSite, HTTPS]
        L2[Layer 2: Authentication<br/>Passport.js + Yale CAS]
        L3[Layer 3: Authorization<br/>Role-based access control]
        L4[Layer 4: Field-Level Permissions<br/>Granular field access]
        L5[Layer 5: CSRF Protection<br/>Custom header validation]
        L6[Layer 6: Rate Limiting<br/>Prevent abuse]
        L7[Layer 7: Audit Logging<br/>Track all actions]
        L8[Layer 8: Input Validation<br/>Sanitize and validate data]
    end

    Request[Request] --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    L5 --> L6
    L6 --> L7
    L7 --> L8
    L8 --> App[Application Logic]

    style L1 fill:#ffebee
    style L2 fill:#fce4ec
    style L3 fill:#f3e5f5
    style L4 fill:#ede7f6
    style L5 fill:#e8eaf6
    style L6 fill:#e3f2fd
    style L7 fill:#e1f5fe
    style L8 fill:#e0f7fa
```

## Audit Log Data Flow

```mermaid
graph LR
    Request[HTTP Request] --> Middleware[Audit Middleware]

    Middleware --> Capture[Capture Request Data]
    Capture --> Store1[In-Memory Store<br/>Development]
    Capture --> Store2[Database<br/>Production]
    Capture --> Store3[External Service<br/>e.g., DataDog, Splunk]

    Store2 --> Query[Query Interface]
    Query --> AdminUI[Admin Dashboard]
    Query --> Reports[Compliance Reports]

    Store3 --> Alerts[Real-time Alerts]
    Store3 --> Analytics[Security Analytics]

    style Capture fill:#fff9c4
    style Store2 fill:#c8e6c9
    style Store3 fill:#b3e5fc
```

## Error Response Flow

```mermaid
graph TB
    Request[Request] --> Auth{Authenticated?}

    Auth -->|No| E401[401 Unauthorized<br/>AUTH_REQUIRED]
    Auth -->|Yes| Role{Has Role?}

    Role -->|No| E403a[403 Forbidden<br/>INSUFFICIENT_PERMISSIONS]
    Role -->|Yes| CSRF{Valid CSRF?}

    CSRF -->|No| E403b[403 Forbidden<br/>CSRF_VALIDATION_FAILED]
    CSRF -->|Yes| Fields{Valid Fields?}

    Fields -->|No| FieldType{Field Type?}
    FieldType -->|Unknown| E400[400 Bad Request<br/>INVALID_FIELDS]
    FieldType -->|Unauthorized| E403c[403 Forbidden<br/>FIELD_AUTHORIZATION_ERROR]

    Fields -->|Yes| Rate{Within Rate Limit?}

    Rate -->|No| E429[429 Too Many Requests<br/>RATE_LIMIT_EXCEEDED]
    Rate -->|Yes| Handler[Route Handler]

    Handler --> Success[200/201 OK]
    Handler --> ServerError[500 Internal Server Error]

    style E401 fill:#ffcdd2
    style E403a fill:#ffcdd2
    style E403b fill:#ffcdd2
    style E403c fill:#ffcdd2
    style E400 fill:#ffe0b2
    style E429 fill:#fff9c4
    style Success fill:#c8e6c9
```

## Rate Limiting Architecture

```mermaid
graph TB
    Request[Request] --> Extract[Extract Key<br/>netId or IP]

    Extract --> Cache{Key in Cache?}

    Cache -->|No| Create[Create Entry<br/>count=1, resetTime=now+window]
    Create --> Allow[Allow Request]

    Cache -->|Yes| Check{resetTime < now?}

    Check -->|Yes| Reset[Reset Entry<br/>count=1, resetTime=now+window]
    Reset --> Allow

    Check -->|No| Increment[Increment count]
    Increment --> Limit{count > max?}

    Limit -->|Yes| Reject[429 Response<br/>retryAfter calculated]
    Limit -->|No| Allow

    Allow --> Next[Next Middleware]

    style Create fill:#c8e6c9
    style Reset fill:#c8e6c9
    style Allow fill:#c8e6c9
    style Reject fill:#ffcdd2
```

## Session Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant CAS as Yale CAS
    participant App as BlueBite Server
    participant S as Session Store
    participant DB as Database

    B->>App: GET /auth/cas
    App->>CAS: Redirect to CAS login
    CAS->>B: Show login form
    B->>CAS: Submit credentials
    CAS->>App: Redirect with ticket
    App->>CAS: Validate ticket
    CAS->>App: User profile (netId)
    App->>DB: Lookup user by netId
    DB->>App: User with role
    App->>S: Create session
    S->>App: Session ID
    App->>B: Set session cookie

    Note over B,S: Subsequent requests

    B->>App: Request with session cookie
    App->>S: Validate session
    S->>App: User data (netId, role)
    App->>App: Check authorization
    App->>DB: Perform operation
    DB->>App: Result
    App->>B: Response
```

## Production Architecture

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[NGINX/AWS ALB]
    end

    subgraph "Application Servers"
        App1[BlueBite Instance 1]
        App2[BlueBite Instance 2]
        App3[BlueBite Instance 3]
    end

    subgraph "Data Layer"
        Redis[(Redis<br/>Sessions & Rate Limiting)]
        Postgres[(PostgreSQL<br/>Application Data & Audit Logs)]
    end

    subgraph "External Services"
        CAS[Yale CAS]
        Monitoring[DataDog/CloudWatch]
        Logs[Log Aggregation]
    end

    LB --> App1
    LB --> App2
    LB --> App3

    App1 --> Redis
    App2 --> Redis
    App3 --> Redis

    App1 --> Postgres
    App2 --> Postgres
    App3 --> Postgres

    App1 --> CAS
    App2 --> CAS
    App3 --> CAS

    App1 --> Monitoring
    App2 --> Monitoring
    App3 --> Monitoring

    App1 --> Logs
    App2 --> Logs
    App3 --> Logs

    style Redis fill:#ff6b6b
    style Postgres fill:#4ecdc4
    style CAS fill:#95e1d3
```

## Key Design Principles

### 1. Defense in Depth
Multiple layers of security ensure that if one layer is compromised, others still protect the system.

### 2. Fail Secure
When middleware detects a security violation, it immediately rejects the request rather than attempting recovery.

### 3. Least Privilege
Users receive the minimum permissions necessary to perform their tasks. Staff can only modify operational flags, not structural data.

### 4. Separation of Concerns
Each middleware has a single responsibility:
- Authentication: Verify identity
- Authorization: Verify permissions
- Field validation: Verify input structure
- Rate limiting: Prevent abuse
- Audit logging: Record actions

### 5. Explicit Over Implicit
All security decisions are explicit. No "default allow" behavior. Middleware explicitly checks and explicitly rejects or allows.

### 6. Auditability
All actions are logged with sufficient detail to reconstruct what happened, when, and by whom.

### 7. Zero Trust
Every request is fully validated regardless of source. No assumptions about client behavior.

## Performance Considerations

### Middleware Order Optimization
1. **Cheapest first**: Authentication check (session lookup) before expensive operations
2. **Early rejection**: Reject unauthorized requests before rate limiting or logging
3. **Caching**: Cache role checks in session to avoid repeated database lookups
4. **Async operations**: Audit logging should not block response

### Scaling Considerations
1. **Stateless middleware**: All middleware is stateless except for shared stores (Redis)
2. **Horizontal scaling**: Multiple app instances share Redis for sessions and rate limiting
3. **Database connection pooling**: Limit concurrent database connections
4. **CDN caching**: Cache public menu data at edge

## Security Best Practices

### Session Security
- HttpOnly cookies prevent XSS attacks
- SameSite prevents CSRF attacks
- Secure flag ensures HTTPS-only transmission
- Short expiration (24 hours) limits exposure

### CSRF Protection
- Custom header approach (simple, effective)
- SameSite cookie as defense in depth
- State-changing operations only (POST/PUT/PATCH/DELETE)

### Rate Limiting
- Per-user limits prevent individual abuse
- Global limits prevent DDoS
- Different limits for different roles
- Gradual backoff (retry-after header)

### Audit Logging
- Log all authenticated actions
- Include sufficient context (who, what, when, where)
- Immutable logs (append-only)
- Retention policy (compliance requirements)
- Sensitive data protection (don't log passwords, tokens)

## Compliance Considerations

### FERPA (Educational Records)
- Audit logs track access to student data
- Role-based access ensures only authorized personnel access records
- Session timeout enforces re-authentication

### GDPR (If Applicable)
- Audit logs support data access requests
- User data deletion supported
- Consent tracking possible via audit logs

### SOC 2 (If Applicable)
- Comprehensive audit logging
- Access control enforcement
- Security monitoring and alerting
