# BlueBite Frontend

A modern, aesthetic frontend for the BlueBite buttery ordering system, built with React, TypeScript, and Tailwind CSS.

## Features

### Layout
- **Header**: Blue gradient header with BlueBite branding (B logo placeholder)
- **Split-screen UI**: Left side for ordering, right side for cart and order management

### On-Computer Ordering (Left Panel)
- **Menu Grid**: Categorized items (Main, Salads, Sides, Drinks, Desserts)
- **Item Cards**: Display item name, price, hot/cold indicator
- **Modifiers**: Modal popup for selecting add-ons with price adjustments
- **Quantity Controls**: Plus/minus buttons to adjust quantity before adding to cart

### Cart Panel (Right Top)
- **Item Management**: Add and remove items from cart
- **Order Summary**: Real-time total price calculation
- **Actions**:
  - Confirm Order: Create and submit order to system
  - Pass to Customer: 3-second countdown warning before order placement

### Order Manager (Right Bottom)
- **Real-time Order List**: Orders sorted by placement time
- **Status Badges**: Color-coded status (pending, preparing, ready, completed, cancelled)
- **Expandable Details**: View items, modifiers, and special instructions
- **Status Transitions**: Buttons to move orders through workflow
- **Undo Functionality**: Revert last status change within session

## Data Persistence

All data is stored in localStorage:
- **Menu items**: Static mock data loaded on first run
- **Orders**: Persistent across page reloads
- **Cart**: Current shopping cart state

## Tech Stack

- **React 19.2**: Latest React with hooks
- **TypeScript 5.9**: Full type safety
- **Tailwind CSS 4.1**: Modern utility-first styling
- **Lucide Icons**: Clean icon library
- **PostCSS 8.5**: CSS processing
- **Vite 7.2**: Lightning-fast dev server and build

## Running the Project

```bash
# Development
npm run dev

# Build
npm run build

# Preview production build
npm preview

# Linting
npm run lint
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx
│   ├── MenuGrid.tsx
│   ├── ModifierModal.tsx
│   ├── CartPanel.tsx
│   └── OrderManager.tsx
├── utils/
│   ├── storage.ts       # localStorage management
│   └── mockData.ts      # Mock menu and order data
├── types.ts             # TypeScript interfaces
├── App.tsx              # Main app component
├── index.css            # Global styles
└── main.tsx             # Entry point
```

## Features Implemented

✅ Split-screen layout with menu and order management
✅ Menu grid with categories and item filtering
✅ Modifier selection with price adjustments
✅ Shopping cart with add/remove functionality
✅ Order creation and management
✅ Real-time order status simulation (every 5 seconds)
✅ Undo functionality for order status changes
✅ localStorage persistence
✅ Responsive design
✅ Uber Eats/DoorDash-inspired blue color scheme
✅ Notifications for user actions

## Color Scheme

- **Primary Blue**: `#0066FF` - Main brand color (buttons, headers)
- **Dark Blue**: `#003DB3` - Hover states
- **Light Blue**: `#4D99FF` - Accents and highlights
- **Neutral Grays**: Background and text

## Future Enhancements

- WebSocket integration for real-time updates
- Login system with resco selection
- Admin panel for debugging
- Mobile responsive improvements
- Sound notifications for order status changes
- Order notes/special instructions
- Customer authentication (Yale SSO)
- Analytics dashboard
