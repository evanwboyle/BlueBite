# BlueBite Backend Setup & API Documentation

## Current Status

✅ **Backend is fully operational** and connected to Supabase PostgreSQL database.

### Running Services
- **API Server**: http://localhost:3000
- **Database**: Supabase PostgreSQL (aws-0-us-west-2.pooler.supabase.com)
- **Framework**: Express.js with TypeScript
- **ORM**: Prisma v5.22.0

## Recent Updates (December 2025)

### NetID-Based User Management
- ✅ Users identified by NetID (Yale Net ID) instead of email/password
- ✅ No password required - NetID serves as unique identifier
- ✅ Users are automatically created on first order with `netId` as primary key
- ✅ Staff/admin can view all orders regardless of which NetID placed them

### Server-Side Implementation
- ✅ Orders are now fully stored in the database (not localStorage)
- ✅ Order creation accepts order items in a single transaction
- ✅ Buttery/residential college filtering for menus and orders
- ✅ New `/api/butteries` endpoint to discover available colleges with item counts
- ✅ New `/api/orders` endpoint returns all orders (staff/admin view)
- ✅ All data is persisted to PostgreSQL - no mock data fallbacks
- ✅ Automatic user creation via `upsert` when placing orders with new NetID

### Frontend Integration
- ✅ Frontend fetches all data from backend API
- ✅ NetID input required before placing orders
- ✅ Orders persist across page refreshes
- ✅ Error handling shows API issues immediately
- ✅ CORS properly configured for localhost:5173
- ✅ Yalies API integration for user profile lookup (names, pictures)
- ✅ Menu item names enriched in order display
- ✅ Orders display in reverse chronological order (newest at bottom)
- ✅ 12-hour order window with sequential "Order #X" labeling

## Database Schema

The following tables are created in Supabase:

- **users** - User accounts and authentication
- **menuItems** - Menu items with pricing and descriptions
- **modifiers** - Add-ons/customizations for items
- **orders** - Customer orders with status tracking
- **orderItems** - Individual items within an order
- **orderItemModifiers** - Junction table for item customizations

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account with active project

### Environment Variables

Create `.env` in `/backend` directory:

```env
# Supabase Database Connection
DATABASE_URL="postgresql://[user]:[password]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://[user]:[password]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
PORT=3000
```

### Installation

```bash
cd backend
npm install
```

### Running the Server

**Development** (with hot reload):
```bash
npm run dev
```

**Production Build**:
```bash
npm run build
npm start
```

**Database Migrations**:
```bash
npm run db:push   # Push schema changes
npm run db:pull   # Pull schema from database
```

## API Endpoints

### Health & Status

#### GET `/`
Health check endpoint.

**Response**:
```json
{
  "message": "BlueBite API is running!",
  "status": "ok"
}
```

#### GET `/api/health`
Test database connection.

**Response**:
```json
{
  "status": "Database connected",
  "ping": [{"ping": 1}]
}
```

### Users

#### POST `/api/users`
Create a new user by NetID.

**Request Body**:
```json
{
  "netId": "abc123",
  "name": "John Doe"
}
```

**Response** (201):
```json
{
  "netId": "abc123",
  "name": "John Doe",
  "role": "customer",
  "createdAt": "2025-12-02T20:35:43.432Z",
  "updatedAt": "2025-12-02T20:35:43.432Z"
}
```

**Note**: Users are automatically created when placing an order with a new NetID, so explicit user creation is optional.

### Menu Items

#### GET `/api/menu`
Get all menu items with modifiers (sorted by category).

**Response**:
```json
[
  {
    "id": "cmijvregf0000l3e2bjrqn6of",
    "name": "Classic Sandwich",
    "description": "Delicious turkey and cheese",
    "price": 12.99,
    "category": "Sandwiches",
    "available": true,
    "image": null,
    "createdAt": "2025-11-29T05:58:16.047Z",
    "updatedAt": "2025-11-29T05:58:16.047Z",
    "modifiers": [
      {
        "id": "cmijvriey0002l3e27g8uva3j",
        "name": "Extra Cheese",
        "description": "Add extra cheese",
        "price": 1.50
      }
    ]
  }
]
```

#### POST `/api/menu`
Create a new menu item.

**Request Body**:
```json
{
  "name": "Classic Sandwich",
  "description": "Delicious turkey and cheese",
  "price": 12.99,
  "category": "Sandwiches",
  "available": true,
  "image": null
}
```

**Response** (201):
```json
{
  "id": "cmijvregf0000l3e2bjrqn6of",
  "name": "Classic Sandwich",
  "description": "Delicious turkey and cheese",
  "price": 12.99,
  "category": "Sandwiches",
  "available": true,
  "image": null,
  "createdAt": "2025-11-29T05:58:16.047Z",
  "updatedAt": "2025-11-29T05:58:16.047Z",
  "modifiers": []
}
```

#### GET `/api/menu/:itemId`
Get a specific menu item by ID.

**Response**:
```json
{
  "id": "cmijvregf0000l3e2bjrqn6of",
  "name": "Classic Sandwich",
  "description": "Delicious turkey and cheese",
  "price": 12.99,
  "category": "Sandwiches",
  "available": true,
  "image": null,
  "createdAt": "2025-11-29T05:58:16.047Z",
  "updatedAt": "2025-11-29T05:58:16.047Z",
  "modifiers": [
    {
      "id": "cmijvriey0002l3e27g8uva3j",
      "name": "Extra Cheese",
      "description": "Add extra cheese",
      "price": 1.50
    }
  ]
}
```

#### GET `/api/menu/category/:category`
Get all menu items in a specific category.

**Example**: `/api/menu/category/Sandwiches`

**Response**:
```json
[
  {
    "id": "cmijvregf0000l3e2bjrqn6of",
    "name": "Classic Sandwich",
    "description": "Delicious turkey and cheese",
    "price": 12.99,
    "category": "Sandwiches",
    "available": true,
    "image": null,
    "createdAt": "2025-11-29T05:58:16.047Z",
    "updatedAt": "2025-11-29T05:58:16.047Z",
    "modifiers": []
  }
]
```

#### POST `/api/menu/:itemId/modifiers`
Create a modifier (add-on) for a menu item.

**Request Body**:
```json
{
  "name": "Extra Cheese",
  "description": "Add extra cheese",
  "price": 1.50
}
```

**Response** (201):
```json
{
  "id": "cmijvriey0002l3e27g8uva3j",
  "name": "Extra Cheese",
  "description": "Add extra cheese",
  "price": 1.50,
  "menuItemId": "cmijvregf0000l3e2bjrqn6of",
  "createdAt": "2025-11-29T05:58:21.179Z",
  "updatedAt": "2025-11-29T05:58:21.179Z"
}
```

#### GET `/api/menu/:itemId/modifiers`
Get all modifiers for a specific menu item.

**Response**:
```json
[
  {
    "id": "cmijvriey0002l3e27g8uva3j",
    "name": "Extra Cheese",
    "description": "Add extra cheese",
    "price": 1.50,
    "menuItemId": "cmijvregf0000l3e2bjrqn6of",
    "createdAt": "2025-11-29T05:58:21.179Z",
    "updatedAt": "2025-11-29T05:58:21.179Z"
  }
]
```

### Orders

#### POST `/api/orders`
Create a new order with items. Automatically creates user if NetID doesn't exist.

**Request Body**:
```json
{
  "netId": "ewb28",
  "totalPrice": 45.99,
  "buttery": "Branford",
  "items": [
    {
      "menuItemId": "cmijvregf0000l3e2bjrqn6of",
      "quantity": 2,
      "price": 12.99
    },
    {
      "menuItemId": "cmijvregf0001l3e2bjrqn6og",
      "quantity": 1,
      "price": 19.01
    }
  ]
}
```

**Response** (201):
```json
{
  "id": "cmip1i4dk0009rdvyvboq151e",
  "netId": "ewb28",
  "buttery": "Branford",
  "status": "pending",
  "totalPrice": 45.99,
  "createdAt": "2025-12-02T20:37:51.656Z",
  "updatedAt": "2025-12-02T20:37:51.656Z",
  "orderItems": [
    {
      "id": "cmip1i4dk000brdvy8sfcs4tc",
      "orderId": "cmip1i4dk0009rdvyvboq151e",
      "menuItemId": "cmijvregf0000l3e2bjrqn6of",
      "quantity": 2,
      "price": 12.99,
      "modifiers": []
    }
  ]
}
```

#### GET `/api/orders`
Get all orders (staff/admin view), optionally filtered by buttery.

**Query Parameters**:
- `buttery` (optional): Filter orders by residential college (e.g., `?buttery=Branford`)

**Example**: `/api/orders?buttery=Branford`

**Response**:
```json
[
  {
    "id": "cmip1i4dk0009rdvyvboq151e",
    "netId": "ewb28",
    "buttery": "Branford",
    "status": "ready",
    "totalPrice": 2,
    "createdAt": "2025-12-02T20:37:51.656Z",
    "updatedAt": "2025-12-02T20:38:37.770Z",
    "orderItems": [
      {
        "id": "cmip1i4dk000brdvy8sfcs4tc",
        "orderId": "cmip1i4dk0009rdvyvboq151e",
        "menuItemId": "cmip15eew001heuyesnva45f7",
        "quantity": 1,
        "price": 2,
        "createdAt": "2025-12-02T20:37:51.656Z",
        "updatedAt": "2025-12-02T20:37:51.656Z",
        "modifiers": []
      }
    ]
  }
]
```

#### GET `/api/users/:netId/orders`
Get all orders for a specific NetID, optionally filtered by buttery.

**Query Parameters**:
- `buttery` (optional): Filter orders by residential college (e.g., `?buttery=Branford`)

**Example**: `/api/users/ewb28/orders?buttery=Branford`

**Response**:
```json
[
  {
    "id": "cmip1i4dk0009rdvyvboq151e",
    "netId": "ewb28",
    "buttery": "Branford",
    "status": "pending",
    "totalPrice": 45.99,
    "createdAt": "2025-12-02T20:37:51.656Z",
    "updatedAt": "2025-12-02T20:37:51.656Z",
    "orderItems": [
      {
        "id": "cmip1i4dk000brdvy8sfcs4tc",
        "orderId": "cmip1i4dk0009rdvyvboq151e",
        "menuItemId": "cmijvregf0000l3e2bjrqn6of",
        "quantity": 2,
        "price": 12.99,
        "modifiers": []
      }
    ]
  }
]
```

#### PATCH `/api/orders/:orderId`
Update order status.

**Request Body**:
```json
{
  "status": "preparing"
}
```

**Valid Statuses**: `pending`, `preparing`, `ready`, `completed`, `cancelled`

**Response**:
```json
{
  "id": "cmip1i4dk0009rdvyvboq151e",
  "netId": "ewb28",
  "buttery": "Branford",
  "status": "preparing",
  "totalPrice": 45.99,
  "createdAt": "2025-12-02T20:37:51.656Z",
  "updatedAt": "2025-12-02T20:38:10.123Z",
  "orderItems": []
}
```

### Butteries / Residential Colleges

#### GET `/api/butteries`
Get list of all butteries/residential colleges with item counts.

**Response**:
```json
[
  {
    "name": "Berkeley",
    "itemCount": 28
  },
  {
    "name": "Branford",
    "itemCount": 19
  },
  {
    "name": "Davenport",
    "itemCount": 17
  },
  {
    "name": "Ezra Stiles",
    "itemCount": 47
  },
  {
    "name": "Timothy Dwight",
    "itemCount": 29
  }
]
```

### Menu Items with Buttery Filter

#### GET `/api/menu`
Get all menu items, optionally filtered by buttery/residential college.

**Query Parameters**:
- `buttery` (optional): Filter items by residential college (e.g., `?buttery=Berkeley`)

**Example**: `/api/menu?buttery=Berkeley`

**Response**:
```json
[
  {
    "id": "cmik0zxkp0017olchtn7aojbe",
    "name": "Ice Cream",
    "description": "Sandwich, Drumstick, Bar, Fruit Bars",
    "price": 1,
    "category": "Dessert",
    "available": true,
    "hot": false,
    "buttery": "Berkeley",
    "image": null,
    "createdAt": "2025-11-29T08:24:52.153Z",
    "updatedAt": "2025-11-29T08:24:52.153Z",
    "modifiers": []
  }
]
```

## Testing

You can test endpoints using curl:

```bash
# Create a user by NetID (optional - users auto-create on order)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"netId":"abc123","name":"Test User"}'

# Create a menu item
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -d '{"name":"Classic Sandwich","description":"Turkey and cheese","price":12.99,"category":"Sandwiches","available":true}'

# Add a modifier to menu item
curl -X POST http://localhost:3000/api/menu/ITEM_ID/modifiers \
  -H "Content-Type: application/json" \
  -d '{"name":"Extra Cheese","price":1.50,"description":"Add extra cheese"}'

# Get all menu items
curl http://localhost:3000/api/menu

# Get menu items by buttery
curl http://localhost:3000/api/menu?buttery=Branford

# Get menu items by category
curl http://localhost:3000/api/menu/category/Sandwiches

# Create an order (auto-creates user if NetID doesn't exist)
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "netId":"ewb28",
    "totalPrice":25.50,
    "buttery":"Branford",
    "items":[{"menuItemId":"ITEM_ID","quantity":1,"price":25.50}]
  }'

# Get all orders (staff/admin view)
curl http://localhost:3000/api/orders

# Get all orders for a specific buttery
curl http://localhost:3000/api/orders?buttery=Branford

# Get user's orders by NetID
curl http://localhost:3000/api/users/ewb28/orders

# Get user's orders by NetID and buttery
curl http://localhost:3000/api/users/ewb28/orders?buttery=Branford

# Update order status
curl -X PATCH http://localhost:3000/api/orders/YOUR_ORDER_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"ready"}'

# Get all butteries
curl http://localhost:3000/api/butteries

# Get health status
curl http://localhost:3000/api/health
```

## Current Capabilities

✅ NetID-based user management (automatic user creation on first order)
✅ User creation by NetID (no password required)
✅ Menu management (create items, add modifiers)
✅ Menu browsing (get all items, filter by category or buttery)
✅ Order creation with order items (full transaction)
✅ Automatic user upsert when placing orders with new NetID
✅ Staff/admin order view (GET `/api/orders` returns all orders)
✅ User-specific order view (GET `/api/users/:netId/orders`)
✅ Order tracking and status management
✅ Buttery/residential college filtering for orders and menu
✅ Buttery discovery (list all colleges with item counts)
✅ Database persistence in Supabase PostgreSQL
✅ CORS properly configured for frontend integration
✅ Yalies API integration for user profile lookup (frontend-only)
✅ Menu item names enriched in order display
✅ 12-hour order window with sequential labeling

## Next Steps

- Implement authentication/JWT tokens for secure endpoints
- Add input validation with Zod or similar
- Add update/delete endpoints for menu items
- Implement user registration with password hashing (bcrypt)
- Add comprehensive error handling and proper status codes
- Implement WebSocket for real-time order status updates
- Add pagination for large menu/order lists
- Deploy to production (Railway, Render, or Heroku)
- Set up monitoring and logging (Sentry, LogRocket)

## Troubleshooting

### Server won't start
- Check if port 3000 is available: `lsof -i :3000`
- Verify `.env` file has correct Supabase credentials
- Run `npm install` to ensure all dependencies are installed

### Database connection fails
- Verify Supabase credentials in `.env`
- Check internet connection to Supabase
- Ensure database isn't in "paused" state on Supabase dashboard

### Prisma generation errors
- Run `npm install` to reinstall dependencies
- Delete `node_modules/@prisma` and run `npm install` again

## Related Documentation

### CAS Authentication
For Yale CAS login implementation, see: [CAS-AUTHENTICATION.md](./CAS-AUTHENTICATION.md)

This document covers:
- Yale CAS authentication flow and setup
- Session-based authentication with Passport.js
- Frontend integration for user login
- Testing CAS login in development
- Production deployment and security considerations

### Yalies API Integration
For Yalies API integration details, see: [YALIES-INTEGRATION.md](./YALIES-INTEGRATION.md)

This document covers:
- Frontend-only user profile lookup using Yalies API
- Caching strategy for user data
- Display of student names and profile pictures in orders
- API key configuration and security considerations
