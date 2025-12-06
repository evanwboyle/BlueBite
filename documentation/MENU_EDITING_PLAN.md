# Menu Editing Feature - Simple Implementation Plan

Just a straightforward guide to add menu editing to BlueBite. No corporate BS.

---

## What We're Building

**Staff users** can toggle menu items on/off and mark them as hot/cold.
**Admin users** can do everything - edit prices, names, add/delete items and modifiers.

**Where it lives**: Settings modal gets a new "Edit Menu" tab (only shows up for staff/admin).

**How it works**: Click to edit, changes save immediately with that nice optimistic update pattern you already use for orders.

---

## User Answers from Questionnaire

- **Access**: Two-tier (staff = toggles only, admin = everything)
- **Location**: Settings modal with tabs
- **Workflow**: Modal-based editing (like ItemDetailModal)
- **Save**: Immediate sync with optimistic updates

---

## Backend Changes

### 1. Add RBAC Middleware (`backend/src/middleware/auth.ts`)

Simple helpers to check if someone's logged in and what role they have:

```typescript
import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

export const requireStaff = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'staff' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Staff or admin access required' });
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
```

### 2. Add New API Routes (`backend/src/index.ts`)

Add these routes with the middleware:

```typescript
import { requireAuth, requireStaff, requireAdmin } from './middleware/auth';

// Staff + Admin: Toggle availability or hot status
app.patch('/api/menu/:itemId/toggle', requireAuth, requireStaff, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { available, hot } = req.body;

    // Only allow updating available or hot (staff limitation)
    const updates: any = {};
    if (typeof available === 'boolean') updates.available = available;
    if (typeof hot === 'boolean') updates.hot = hot;

    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: updates,
      include: { modifiers: true },
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Admin only: Update entire menu item
app.put('/api/menu/:itemId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, description, price, category, available, hot, buttery, image } = req.body;

    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: { name, description, price, category, available, hot, buttery, image },
      include: { modifiers: true },
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Admin only: Delete menu item
app.delete('/api/menu/:itemId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;
    await prisma.menuItem.delete({ where: { id: itemId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Admin only: Add existing POST /api/menu protection
app.post('/api/menu', requireAuth, requireAdmin, async (req, res) => {
  // ... existing code
});

// Admin only: Update modifier
app.put('/api/menu/:itemId/modifiers/:modifierId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { modifierId } = req.params;
    const { name, description, price } = req.body;

    const modifier = await prisma.modifier.update({
      where: { id: modifierId },
      data: { name, description, price },
    });

    res.json(modifier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update modifier' });
  }
});

// Admin only: Delete modifier
app.delete('/api/menu/:itemId/modifiers/:modifierId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { modifierId } = req.params;
    await prisma.modifier.delete({ where: { id: modifierId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete modifier' });
  }
});
```

That's it for backend. Just add those middleware checks and routes.

---

## Frontend Changes

### 1. Update API Utils (`src/utils/api.ts`)

Add these methods:

```typescript
export const api = {
  // ... existing methods

  updateMenuItem: async (id: string, updates: Partial<MenuItem>): Promise<MenuItem> => {
    const response = await fetch(`${API_BASE_URL}/menu/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update item');
    return response.json();
  },

  toggleMenuItem: async (id: string, updates: { available?: boolean; hot?: boolean }): Promise<MenuItem> => {
    const response = await fetch(`${API_BASE_URL}/menu/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to toggle item');
    return response.json();
  },

  deleteMenuItem: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/menu/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete item');
  },

  createMenuItem: async (item: Omit<MenuItem, 'id'>): Promise<MenuItem> => {
    const response = await fetch(`${API_BASE_URL}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(item),
    });
    if (!response.ok) throw new Error('Failed to create item');
    return response.json();
  },

  updateModifier: async (itemId: string, modifierId: string, updates: Partial<Modifier>): Promise<Modifier> => {
    const response = await fetch(`${API_BASE_URL}/menu/${itemId}/modifiers/${modifierId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update modifier');
    return response.json();
  },

  deleteModifier: async (itemId: string, modifierId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/menu/${itemId}/modifiers/${modifierId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete modifier');
  },
};
```

### 2. Update App.tsx

Add handlers for menu operations (similar to how you handle orders):

```typescript
// Add these handlers in App.tsx
const handleUpdateMenuItem = (id: string, updates: Partial<MenuItem>) => {
  optimisticUpdate.execute({
    optimisticUpdate: () => {
      const newItems = menuItems.map(item =>
        item.id === id ? { ...item, ...updates } : item
      );
      setMenuItems(newItems);
      storage.setCachedMenu(newItems, selectedButtery);
    },
    syncFn: () => api.updateMenuItem(id, updates),
    onSuccess: (updatedItem) => {
      const newItems = menuItems.map(item =>
        item.id === id ? updatedItem : item
      );
      setMenuItems(newItems);
      storage.setCachedMenu(newItems, selectedButtery);
    },
    onError: (error) => {
      setNotification(`Failed to update item: ${error.message}`);
    },
    id: `menu-item-${id}`,
  });
};

const handleDeleteMenuItem = (id: string) => {
  optimisticUpdate.execute({
    optimisticUpdate: () => {
      const newItems = menuItems.filter(item => item.id !== id);
      setMenuItems(newItems);
      storage.setCachedMenu(newItems, selectedButtery);
    },
    syncFn: () => api.deleteMenuItem(id),
    onSuccess: () => {
      setNotification('Item deleted');
      setTimeout(() => setNotification(null), 2000);
    },
    onError: (error) => {
      setNotification(`Failed to delete: ${error.message}`);
    },
    id: `menu-delete-${id}`,
  });
};

const handleCreateMenuItem = async (item: Omit<MenuItem, 'id'>) => {
  try {
    const newItem = await api.createMenuItem(item);
    const newItems = [...menuItems, newItem];
    setMenuItems(newItems);
    storage.setCachedMenu(newItems, selectedButtery);
    setNotification('Item created!');
    setTimeout(() => setNotification(null), 2000);
  } catch (error) {
    setNotification(`Failed to create item: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Pass these to SettingsModal
<SettingsModal
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  currentUser={currentUser}
  onUserLogout={() => setCurrentUser(null)}
  // NEW PROPS:
  menuItems={menuItems}
  selectedButtery={selectedButtery}
  butteryOptions={butteryOptions}
  onUpdateMenuItem={handleUpdateMenuItem}
  onDeleteMenuItem={handleDeleteMenuItem}
  onCreateMenuItem={handleCreateMenuItem}
/>
```

### 3. Update SettingsModal (`src/components/SettingsModal.tsx`)

Add tab navigation and pass props to new MenuEditorTab:

```typescript
import { useState } from 'react';
import { Settings, X, LogOut } from 'lucide-react';
import { MenuEditorTab } from './MenuEditorTab';
import type { User, MenuItem } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserLogout: () => void;
  menuItems: MenuItem[];
  selectedButtery: string | null;
  butteryOptions: Array<{name: string; itemCount: number}>;
  onUpdateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  onDeleteMenuItem: (id: string) => void;
  onCreateMenuItem: (item: Omit<MenuItem, 'id'>) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  onUserLogout,
  menuItems,
  selectedButtery,
  butteryOptions,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onCreateMenuItem,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'editMenu'>('account');

  if (!isOpen) return null;

  const showEditMenu = currentUser?.role === 'staff' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         style={{ backgroundColor: 'rgba(107, 114, 128, 0.3)' }}
         onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white z-10">
          <div className="flex items-center gap-2">
            <Settings size={24} className="text-gray-700" />
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'account'
                ? 'text-bluebite-primary border-b-2 border-bluebite-primary bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Account
          </button>
          {showEditMenu && (
            <button
              onClick={() => setActiveTab('editMenu')}
              className={`flex-1 px-6 py-3 font-semibold transition ${
                activeTab === 'editMenu'
                  ? 'text-bluebite-primary border-b-2 border-bluebite-primary bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Edit Menu
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'account' ? (
            <div className="space-y-4">
              {currentUser ? (
                <>
                  <div className="text-lg">
                    Logged in as <span className="font-semibold">{currentUser.netId}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Role: <span className="font-medium capitalize">{currentUser.role}</span>
                  </div>
                  <button
                    onClick={async () => {
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                      await fetch(`${apiUrl}/auth/logout`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      onUserLogout();
                    }}
                    className="btn-secondary flex items-center gap-2"
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
                  className="btn-primary"
                >
                  Login with Yale CAS
                </button>
              )}
            </div>
          ) : (
            <MenuEditorTab
              menuItems={menuItems}
              currentUser={currentUser}
              selectedButtery={selectedButtery}
              butteryOptions={butteryOptions}
              isAdmin={isAdmin}
              onUpdateMenuItem={onUpdateMenuItem}
              onDeleteMenuItem={onDeleteMenuItem}
              onCreateMenuItem={onCreateMenuItem}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4. Create MenuEditorTab (`src/components/MenuEditorTab.tsx`)

The main editing interface:

```typescript
import { useState, useMemo } from 'react';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import type { MenuItem, User } from '../types';

interface MenuEditorTabProps {
  menuItems: MenuItem[];
  currentUser: User | null;
  selectedButtery: string | null;
  butteryOptions: Array<{name: string; itemCount: number}>;
  isAdmin: boolean;
  onUpdateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  onDeleteMenuItem: (id: string) => void;
  onCreateMenuItem: (item: Omit<MenuItem, 'id'>) => void;
}

export function MenuEditorTab({
  menuItems,
  isAdmin,
  onUpdateMenuItem,
  onDeleteMenuItem,
}: MenuEditorTabProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Group by category
  const itemsByCategory = useMemo(() => {
    const filtered = menuItems.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped: Record<string, MenuItem[]> = {};
    filtered.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    return grouped;
  }, [menuItems, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search menu items..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Items by category */}
      <div className="space-y-6 max-h-[50vh] overflow-y-auto">
        {Object.entries(itemsByCategory).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-lg font-bold text-gray-700 border-b-2 border-gray-300 pb-2 mb-3">
              {category}
            </h3>
            <div className="space-y-2">
              {items.map(item => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  onToggleAvailable={() => onUpdateMenuItem(item.id, { available: !item.available })}
                  onToggleHot={() => onUpdateMenuItem(item.id, { hot: !item.hot })}
                  onDelete={() => {
                    if (confirm('Delete this item?')) {
                      onDeleteMenuItem(item.id);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple row component
function MenuItemRow({
  item,
  isAdmin,
  onToggleAvailable,
  onToggleHot,
  onDelete,
}: {
  item: MenuItem;
  isAdmin: boolean;
  onToggleAvailable: () => void;
  onToggleHot: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900">{item.name}</h4>
        <span className="text-lg font-bold text-blue-600">${item.price.toFixed(2)}</span>
      </div>

      <div className="flex items-center gap-6 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.available}
            onChange={onToggleAvailable}
            className="w-4 h-4 accent-green-600 rounded cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-700">Available</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.hot}
            onChange={onToggleHot}
            className="w-4 h-4 accent-red-600 rounded cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-700">Hot</span>
        </label>
      </div>

      {isAdmin && (
        <div className="flex gap-2">
          <button className="btn-small flex items-center gap-1 text-red-600 hover:bg-red-50 border border-red-300">
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## That's It!

This gives you:
- Staff can toggle items on/off and hot/cold
- Admin can delete items (we can add full edit modal later if you want)
- Simple role checks on backend
- Uses your existing optimistic update pattern
- Clean UI in Settings modal

**To add later** (if you want):
- Full edit modal for admins to change prices/names
- Create new items
- Edit modifiers
- But honestly, this might be enough for a hobby project!

**Test it**:
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `npm run dev`
3. Login as staff/admin via CAS
4. Open Settings → Edit Menu tab
5. Toggle some items!

Simple. No fluff. Just code.
