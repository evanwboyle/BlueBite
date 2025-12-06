# Menu Editing Feature - Updated Implementation Plan

Revised approach: Edit Mode toggle in Settings, editing happens inline in the menu with modal-based editing.

---

## What We're Building

**Edit Mode** - A toggle in Settings that enables menu editing directly in the MenuGrid.

**Staff users** (when Edit Mode ON):
- See pencil icons on menu items (instead of click-to-view)
- Click pencil to open edit modal with: available toggle, hot toggle
- Cannot delete items

**Admin users** (when Edit Mode ON):
- See pencil icons on menu items (instead of click-to-view)
- Click pencil to open full edit modal with: name, description, price, category, available, hot, delete button
- "Add Item" button in MenuGrid header to create new items
- Can delete items

**Where it lives**:
- Settings modal gets an "Edit Mode" toggle in the Account tab
- When enabled, MenuGrid shows edit icons and Add Item button
- ItemDetailModal gets enhanced to support both view and edit modes

**How it works**:
- Click pencil icon → Opens ItemDetailModal in edit mode
- Changes save immediately with optimistic updates
- Only available for staff/admin users

---

## Backend Changes

**No new backend routes needed!** All API endpoints already exist:
- `PATCH /api/menu/:itemId/toggle` - Staff can toggle available/hot
- `PUT /api/menu/:itemId` - Admin can update all fields
- `DELETE /api/menu/:itemId` - Admin can delete
- `POST /api/menu` - Admin can create (already protected)

Backend is ready to go. Frontend just needs UI updates.

---

## Frontend Changes

### 1. Update App.tsx

Add state for edit mode and pass to MenuGrid:

```typescript
const [isEditMode, setIsEditMode] = useState(false);

// Pass to MenuGrid:
<MenuGrid
  // ... existing props
  isEditMode={isEditMode}
  currentUser={currentUser}
  onOpenItemDetail={(item) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  }}
  onCreateMenuItem={() => {
    setSelectedItem(null);  // null means create mode
    setIsDetailOpen(true);
  }}
/>

// Pass to SettingsModal:
<SettingsModal
  // ... existing props
  isEditMode={isEditMode}
  onSetEditMode={setIsEditMode}
/>
```

### 2. Update SettingsModal.tsx

Replace the tab-based approach with an Edit Mode toggle in the Account tab:

```typescript
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserLogout: () => void;
  isEditMode: boolean;
  onSetEditMode: (enabled: boolean) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  onUserLogout,
  isEditMode,
  onSetEditMode,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const canEdit = currentUser?.role === 'staff' || currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         style={{ backgroundColor: 'rgba(107, 114, 128, 0.3)' }}
         onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Settings size={24} className="text-gray-700" />
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Account Info */}
        <div className="p-6 space-y-4">
          {currentUser ? (
            <>
              <div className="text-lg">
                Logged in as <span className="font-semibold">{currentUser.netId}</span>
              </div>
              <div className="text-sm text-gray-600">
                Role: <span className="font-medium capitalize">{currentUser.role}</span>
              </div>

              {/* Edit Mode Toggle (only for staff/admin) */}
              {canEdit && (
                <div className="border-t pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEditMode}
                      onChange={(e) => onSetEditMode(e.target.checked)}
                      className="w-5 h-5 accent-bluebite-primary rounded cursor-pointer"
                    />
                    <span className="font-medium text-gray-700">Edit Mode</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Enable to edit menu items directly from the menu view
                  </p>
                </div>
              )}

              <button
                onClick={async () => {
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                  await fetch(`${apiUrl}/auth/logout`, {
                    method: 'POST',
                    credentials: 'include',
                  });
                  onUserLogout();
                }}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <LogOut size={18} />
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                window.location.href = `${apiUrl}/auth/login`;
              }}
              className="btn-primary w-full"
            >
              Login with Yale CAS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3. Update MenuGrid.tsx

Add edit mode handling and "Add Item" button:

```typescript
interface MenuGridProps {
  // ... existing props
  isEditMode: boolean;
  currentUser: User | null;
  onOpenItemDetail: (item: MenuItem) => void;
  onCreateMenuItem: () => void;
}

export function MenuGrid({
  // ... existing destructuring
  isEditMode,
  currentUser,
  onOpenItemDetail,
  onCreateMenuItem,
}: MenuGridProps) {
  const canEdit = currentUser?.role === 'staff' || currentUser?.role === 'admin';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* Header with Add Item button */}
      <div className="flex items-center justify-between p-6 border-b bg-white">
        <h2 className="text-2xl font-bold text-gray-900">Menu</h2>
        {isEditMode && canEdit && (
          <button
            onClick={onCreateMenuItem}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add Item
          </button>
        )}
      </div>

      {/* Menu items grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map(item => (
            <div
              key={item.id}
              className="relative bg-white rounded-lg shadow hover:shadow-lg transition"
            >
              {/* Edit Mode: Show pencil icon instead of click behavior */}
              {isEditMode && canEdit ? (
                <button
                  onClick={() => onOpenItemDetail(item)}
                  className="absolute top-2 right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                  title="Edit item"
                >
                  <Pencil size={18} />
                </button>
              ) : null}

              {/* Normal Mode: Show clickable card */}
              {!isEditMode ? (
                <button
                  onClick={() => onOpenItemDetail(item)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition"
                >
                  <h3 className="font-bold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
                </button>
              ) : (
                <div className="p-4 cursor-default">
                  <h3 className="font-bold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4. Update ItemDetailModal.tsx

Add support for edit mode based on user role:

```typescript
interface ItemDetailModalProps {
  item: MenuItem | null;  // null = create mode
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  isEditMode: boolean;
  onUpdateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  onDeleteMenuItem: (id: string) => void;
  onCreateMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  // ... existing props
}

export function ItemDetailModal({
  item,
  isOpen,
  onClose,
  currentUser,
  isEditMode,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onCreateMenuItem,
  // ... existing destructuring
}: ItemDetailModalProps) {
  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';
  const canEdit = isAdmin || isStaff;
  const isCreateMode = isEditMode && !item;

  // ... existing state for modifiers, quantity, etc.

  if (!isOpen || (!item && !isCreateMode)) return null;

  // EDIT MODE
  if (isEditMode && canEdit && item) {
    return (
      <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
            <h2 className="text-2xl font-bold">
              {isCreateMode ? 'Create Item' : 'Edit Item'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {/* Edit Form */}
          <div className="p-6 space-y-4">
            {/* Staff: Limited editing (available + hot toggles only) */}
            {isStaff && !isAdmin && item && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(e) => onUpdateMenuItem(item.id, { available: e.target.checked })}
                    className="w-4 h-4 accent-green-600 rounded"
                  />
                  <span className="font-medium">Available</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.hot}
                    onChange={(e) => onUpdateMenuItem(item.id, { hot: e.target.checked })}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  <span className="font-medium">Hot</span>
                </label>
              </>
            )}

            {/* Admin: Full editing */}
            {isAdmin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={item?.name || ''}
                    onChange={(e) => onUpdateMenuItem(item!.id, { name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={item?.price || 0}
                    onChange={(e) => onUpdateMenuItem(item!.id, { price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={item?.category || ''}
                    onChange={(e) => onUpdateMenuItem(item!.id, { category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={item?.description || ''}
                    onChange={(e) => onUpdateMenuItem(item!.id, { description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item?.available || false}
                    onChange={(e) => onUpdateMenuItem(item!.id, { available: e.target.checked })}
                    className="w-4 h-4 accent-green-600 rounded"
                  />
                  <span className="font-medium">Available</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item?.hot || false}
                    onChange={(e) => onUpdateMenuItem(item!.id, { hot: e.target.checked })}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  <span className="font-medium">Hot</span>
                </label>

                <div className="border-t pt-4">
                  <button
                    onClick={() => {
                      if (confirm('Delete this item?')) {
                        onDeleteMenuItem(item!.id);
                        onClose();
                      }
                    }}
                    className="btn-danger w-full flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    Delete Item
                  </button>
                </div>
              </>
            )}

            {/* Create Mode (admin only) */}
            {isCreateMode && isAdmin && (
              // Similar form to edit, but for creating new item
              // Call onCreateMenuItem when done
              null
            )}
          </div>

          <div className="border-t p-6 flex gap-2 justify-end">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // NORMAL VIEW MODE (existing code)
  return (
    <div>
      {/* ... existing view-only modal code ... */}
    </div>
  );
}
```

---

## Summary of Changes

**What's new:**
1. SettingsModal loses the "Edit Menu" tab
2. SettingsModal gains an "Edit Mode" toggle (Account tab only)
3. MenuGrid shows "Add Item" button when Edit Mode is on
4. MenuGrid items show pencil icon when Edit Mode is on (click to edit)
5. ItemDetailModal gets enhanced to support edit mode
6. Staff can toggle available/hot
7. Admin can edit all fields and delete

**What stays the same:**
- All backend routes already exist
- Menu viewing experience unchanged when not in Edit Mode
- Existing ItemDetailModal for viewing items

---

## Testing Checklist

- [ ] Toggle Edit Mode on/off in Settings
- [ ] In normal mode: clicking items opens detail view (existing behavior)
- [ ] In Edit Mode: pencil icon appears, clicking it opens edit modal
- [ ] Staff: Only see available/hot toggles
- [ ] Admin: See all fields + delete button
- [ ] "Add Item" button only visible in Edit Mode for staff/admin
- [ ] Changes persist after refresh
- [ ] Errors display notifications
- [ ] Switching between Edit Mode and normal mode works smoothly
