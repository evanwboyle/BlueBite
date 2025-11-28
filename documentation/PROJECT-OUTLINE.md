# Project Outline

## Framework Requirements

- React project
- Uses NodeJS and Express for backend

## Project Requirements

### Backend

#### Database Design
- **Menus**:
  - List of residential colleges (rescos)
    - Hours open (and days)
    - Hours with only cold food available
  - List of items:
    - Name
    - ID
    - Picture (optional)
    - Cost
    - Boolean `hot?` (whether it’s considered cold food)
    - Modifiers (e.g., choosing a flavor or adding extra chicken):
      - Price addons for modifiers
    - Category (e.g., deals or allergens)
    - Boolean `disabled?` (for out-of-stock items)

- **Users**:
  - NetID (unique identifier, e.g., ewb28)
  - Picture (fetched from Yalies API)
  - Name (fetched from Yalies API)
  - Phone number (manually inputted, optional)
    - Non-Yale users:
      - Input name and phone number (required)
      - Placeholder picture
      - Generated NetID if necessary
  - Metrics tracked for orders (e.g., order history, items ordered)

- **Orders**:
  - NetID associated with the order
  - Time order was placed
  - Payment status
  - Order number

#### Additional Backend Details
- **Database System**: PostGreSQL
- **ORM**: Prisma
- **Database Migrations**: Use Prisma's built-in migration system to manage schema changes.
- **API Design**: RESTful API with endpoints like `GET /menus`, `POST /menus`, etc.
- **Authentication**: Token-based authentication for now, with future plans for Yale SSO.
- **Data Validation**: Use Zod for schema validation.
- **Scalability**: Redis will be used for caching menus and managing order queues.
- **Error Handling**: Centralized middleware for consistent error handling. Use toast notifications or modals for user-facing errors.

### Order Manager

#### Features
- Right half of the screen sidebar with tabs of orders:
  - Synced to the server for real-time updates
  - Orders displayed with color-coded info and dropdowns for detailed views
  - Dropdowns include compact views, checklists, notes, and details
  - Efficient and intuitive design for buttery workers
  - Orders sorted by placement time
  - Buttons for modifying orders (e.g., mark as complete, cancel)
  - Undo functionality for accidental actions (e.g., "Not Complete?" filter)

#### Additional Order Manager Details
- **Real-Time Updates**: Use WebSockets for syncing orders in real-time.
- **Undo Functionality**: Store actions in a temporary state (e.g., Redux) to allow undoing within a time window.
- **UI/UX**: Follow Material Design principles for intuitive layouts.

### On-Computer Ordering

#### Features
- Left panel with interactive menu for ordering:
  - Buttery worker can either:
    - Select (order for customer)
    - Pass to customer (locks orders tab, 5-second confirmation with sound effect)
  - Menu populated with database info:
    - Dropdowns for images and modifiers
  - Displays total cost during ordering

#### Additional On-Computer Ordering Details
- **Menu UI**: Use a grid layout for items, with images and modifiers displayed in modals or dropdowns.
- **Confirmation Mechanism**: Replace the 5-second delay with a "Confirm Order" button and a clear warning about tampering.
- **Cancellation Handling**: Log cancellations for auditing purposes.

### Admin Panel

#### Features
- Panel for debugging/testing features (TBD):
  - Viewing logs
  - Simulating orders
  - Viewing database stats

#### Additional Admin Panel Details
- **Database Reset/Seeding**: Use Prisma’s `seed` functionality to populate the database with test data.

### Miscellaneous Notes

#### Current Login System
- Bare-bones login:
  - Buttery worker chooses a resco
  - Each resco has its own password

#### Additional Miscellaneous Details
- **Password Storage**: Use bcrypt to hash passwords securely.
- **Session Management**: Use JWTs for stateless authentication, stored in HTTP-only cookies.
- **Deployment**: Host on Vercel. Use GitHub Actions for CI/CD to automate testing, building, and deploying.

## Additional Features (Future)
- Reordering last order
- Streaks and loyalty benefits
- Mobile ordering
- Yale CAS integration
- Buttery statistics page (e.g., best/worst-selling items)
- Feedback page for butteries (e.g., item-specific feedback, new item suggestions)
- SnackPass-like "group ordering" benefits
- Texting integration (e.g., notify user when order is ready)