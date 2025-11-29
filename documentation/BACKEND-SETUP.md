# BlueBite Backend Setup & API Documentation

## Current Status

✅ **Backend is fully operational** and connected to Supabase PostgreSQL database.

### Running Services
- **API Server**: http://localhost:3000
- **Database**: Supabase PostgreSQL (aws-0-us-west-2.pooler.supabase.com)
- **Framework**: Express.js with TypeScript
- **ORM**: Prisma v5.22.0

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
Create a new user.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "hashedPassword123",
  "name": "John Doe"
}
```

**Response** (201):
```json
{
  "id": "cmijvme530000vfbrywvfad2q",
  "email": "user@example.com",
  "password": "hashedPassword123",
  "name": "John Doe",
  "role": "customer",
  "createdAt": "2025-11-29T05:54:22.359Z",
  "updatedAt": "2025-11-29T05:54:22.359Z"
}
```

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
Create a new order.

**Request Body**:
```json
{
  "userId": "cmijvme530000vfbrywvfad2q",
  "totalPrice": 45.99
}
```

**Response** (201):
```json
{
  "id": "cmijvmhzc0002vfbrbboilaqa",
  "userId": "cmijvme530000vfbrywvfad2q",
  "status": "pending",
  "totalPrice": 45.99,
  "createdAt": "2025-11-29T05:54:27.336Z",
  "updatedAt": "2025-11-29T05:54:27.336Z",
  "orderItems": []
}
```

#### GET `/api/users/:userId/orders`
Get all orders for a specific user.

**Response**:
```json
[
  {
    "id": "cmijvmhzc0002vfbrbboilaqa",
    "userId": "cmijvme530000vfbrywvfad2q",
    "status": "pending",
    "totalPrice": 45.99,
    "createdAt": "2025-11-29T05:54:27.336Z",
    "updatedAt": "2025-11-29T05:54:27.336Z",
    "orderItems": []
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
  "id": "cmijvmhzc0002vfbrbboilaqa",
  "userId": "cmijvme530000vfbrywvfad2q",
  "status": "preparing",
  "totalPrice": 45.99,
  "createdAt": "2025-11-29T05:54:27.336Z",
  "updatedAt": "2025-11-29T05:54:36.881Z",
  "orderItems": []
}
```

## Testing

You can test endpoints using curl:

```bash
# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123","name":"Test User"}'

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

# Get menu items by category
curl http://localhost:3000/api/menu/category/Sandwiches

# Create an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","totalPrice":25.50}'

# Get user's orders
curl http://localhost:3000/api/users/YOUR_USER_ID/orders

# Update order status
curl -X PATCH http://localhost:3000/api/orders/YOUR_ORDER_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"ready"}'

# Get health status
curl http://localhost:3000/api/health
```

## Current Capabilities

✅ User management (create users)
✅ Menu management (create items, add modifiers)
✅ Menu browsing (get all items, filter by category)
✅ Order creation and tracking
✅ Order status management
✅ Database persistence in Supabase

## Next Steps

- Add order items endpoints (add specific items to orders)
- Implement authentication/JWT tokens for secure endpoints
- Add input validation with Zod
- Add update/delete endpoints for menu items
- Implement user registration with password hashing
- Add error handling and status codes
- Deploy to production (Railway, Render, or Heroku)
- Set up CORS properly for frontend integration

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
