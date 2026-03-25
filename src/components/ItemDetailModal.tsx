import { useState, useEffect, useRef } from 'react';
import type { MenuItem, OrderItem, User } from '../types';
import { X, Plus, Minus, Trash2, Upload, ImageIcon } from 'lucide-react';
import { GlassPanel } from './ui';

interface ItemDetailModalProps {
  item: MenuItem | null;
  isEditMode?: boolean;
  currentUser?: User | null;
  onAddToCart: (item: OrderItem) => void;
  onUpdateMenuItem?: (id: string, updates: Partial<MenuItem>) => void;
  onDeleteMenuItem?: (id: string) => void;
  onCreateMenuItem?: (item: Omit<MenuItem, 'id'>) => void;
  onClose: () => void;
}

export function ItemDetailModal({
  item,
  isEditMode = false,
  currentUser = null,
  onAddToCart,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onCreateMenuItem,
  onClose
}: ItemDetailModalProps) {
  // View mode state (for adding to cart)
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);

  // Edit mode state
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvailable, setEditAvailable] = useState(true);
  const [editHot, setEditHot] = useState(false);
  const [editImage, setEditImage] = useState<string | undefined>(undefined);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize edit state when item changes
  useEffect(() => {
    if (item) {
      setEditName(item.name);
      setEditPrice(item.price.toString());
      setEditCategory(item.category);
      setEditDescription(item.description || '');
      setEditAvailable(!item.disabled);
      setEditHot(item.hot);
      setEditImage(item.image);
    } else {
      // Creating new item - reset to defaults
      setEditName('');
      setEditPrice('');
      setEditCategory('');
      setEditDescription('');
      setEditAvailable(true);
      setEditHot(false);
      setEditImage(undefined);
    }
  }, [item]);

  const isStaff = currentUser?.role === 'staff';
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = isEditMode && (isStaff || isAdmin);
  const canEditAll = isEditMode && isAdmin;

  // View mode calculations
  const allModifiers = [
    ...(item?.modifiers || []),
    ...(item?.modifierGroups || []).flatMap(g => g.modifiers),
  ];
  const modifierPrice = allModifiers
    .filter(m => selectedModifiers.includes(m.name))
    .reduce((sum, m) => sum + m.price, 0) || 0;

  const totalPrice = item ? (item.price + modifierPrice) * quantity : 0;

  // Determine which modifiers from item.modifiers are ungrouped (not in any group)
  const groupedModifierIds = new Set(
    (item?.modifierGroups || []).flatMap(g => g.modifiers.map(m => m.id))
  );
  const ungroupedModifiers = (item?.modifiers || []).filter(m => !groupedModifierIds.has(m.id));

  // Count selected modifiers within a group
  const getGroupSelectionCount = (groupModifiers: { name: string }[]) => {
    const groupNames = new Set(groupModifiers.map(m => m.name));
    return selectedModifiers.filter(name => groupNames.has(name)).length;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (item?.id) formData.append('itemId', item.id);

      const response = await fetch(`${API_BASE_URL}/upload/menu-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const { url } = await response.json();
      setEditImage(url);
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleToggleModifier = (modifierName: string) => {
    setSelectedModifiers(prev =>
      prev.includes(modifierName)
        ? prev.filter(m => m !== modifierName)
        : [...prev, modifierName]
    );
  };

  const handleToggleGroupModifier = (modifierName: string, group: { required: boolean; maxSelections: number | null; modifiers: { name: string }[] }) => {
    const groupNames = new Set(group.modifiers.map(m => m.name));
    const isRadio = group.maxSelections === 1;

    setSelectedModifiers(prev => {
      const isSelected = prev.includes(modifierName);

      if (isRadio) {
        // Radio behavior
        if (isSelected) {
          // Clicking selected radio: deselect only if not required
          if (group.required) return prev;
          return prev.filter(m => m !== modifierName);
        }
        // Deselect others in group, select this one
        return [...prev.filter(m => !groupNames.has(m)), modifierName];
      }

      // Checkbox behavior
      if (isSelected) {
        return prev.filter(m => m !== modifierName);
      }

      // Check if maxSelections reached
      if (group.maxSelections !== null) {
        const currentCount = prev.filter(m => groupNames.has(m)).length;
        if (currentCount >= group.maxSelections) return prev;
      }

      return [...prev, modifierName];
    });
  };

  const handleAddToCart = () => {
    if (!item) return;

    // Validate required modifier groups
    const unmetGroups: string[] = [];
    for (const group of item.modifierGroups || []) {
      if (group.required) {
        const count = getGroupSelectionCount(group.modifiers);
        if (count < group.minSelections) {
          unmetGroups.push(group.name);
        }
      }
    }
    if (unmetGroups.length > 0) {
      alert(`Please make selections for: ${unmetGroups.join(', ')}`);
      return;
    }

    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      quantity,
      price: item.price + modifierPrice,
      modifiers: selectedModifiers,
    });
  };

  // Edit mode handlers
  const handleToggleAvailable = () => {
    if (!item || !onUpdateMenuItem) return;

    const newAvailable = !editAvailable;
    setEditAvailable(newAvailable);
    onUpdateMenuItem(item.id, { disabled: !newAvailable });
  };

  const handleToggleHot = () => {
    if (!item || !onUpdateMenuItem) return;

    const newHot = !editHot;
    setEditHot(newHot);
    onUpdateMenuItem(item.id, { hot: newHot });
  };

  const handleSaveChanges = () => {
    const price = parseFloat(editPrice);

    // Validation
    if (!editName.trim()) {
      alert('Name is required');
      return;
    }
    if (isNaN(price) || price <= 0) {
      alert('Valid price is required');
      return;
    }
    if (!editCategory.trim()) {
      alert('Category is required');
      return;
    }

    const updates: Omit<MenuItem, 'id'> = {
      name: editName.trim(),
      price,
      category: editCategory.trim(),
      description: editDescription.trim() || undefined,
      hot: editHot,
      disabled: !editAvailable,
      image: editImage,
      modifiers: item?.modifiers || [],
    };

    if (item && onUpdateMenuItem) {
      // Update existing item
      onUpdateMenuItem(item.id, updates);
      onClose();
    } else if (!item && onCreateMenuItem) {
      // Create new item
      onCreateMenuItem(updates);
    }
  };

  const handleDelete = () => {
    if (!item || !onDeleteMenuItem) return;

    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      onDeleteMenuItem(item.id);
      onClose();
    }
  };

  // Render Edit Mode (Staff)
  if (canEdit && isStaff && !isAdmin) {
    return (
      <div
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      >
        <GlassPanel
          level="modal"
          className="max-w-md w-full max-h-[90vh] overflow-y-auto"
          style={{ padding: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="glass-header sticky top-0 flex items-center justify-between p-6">
            <h2 className="text-2xl font-bold text-white">
              Edit: {item?.name || 'New Item'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content - Staff can only edit Available and Hot */}
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              {/* Available Toggle */}
              <GlassPanel level="surface" className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Available</h3>
                  <p className="text-sm text-gray-400">
                    Item is {editAvailable ? 'visible' : 'hidden'} to customers
                  </p>
                </div>
                <button
                  onClick={handleToggleAvailable}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                    editAvailable ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                      editAvailable ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </GlassPanel>

              {/* Hot Toggle */}
              <GlassPanel level="surface" className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Hot Item</h3>
                  <p className="text-sm text-gray-400">Mark as hot food item</p>
                </div>
                <button
                  onClick={handleToggleHot}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                    editHot ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                      editHot ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </GlassPanel>
            </div>
          </div>

          {/* Footer */}
          <div className="glass-header sticky bottom-0 p-6 flex justify-end">
            <button onClick={onClose} className="glass-button px-6 py-2 rounded-lg">
              Close
            </button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  // Render Edit Mode (Admin)
  if (canEditAll) {
    return (
      <div
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      >
        <GlassPanel
          level="modal"
          className="max-w-md w-full max-h-[90vh] overflow-y-auto"
          style={{ padding: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="glass-header sticky top-0 flex items-center justify-between p-6">
            <h2 className="text-2xl font-bold text-white">
              {item ? `Edit: ${item.name}` : 'Create New Item'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content - Admin can edit everything */}
          <div className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Chocolate Chip Cookie"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Snacks, Beverages, Hot Food"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Optional description"
                rows={3}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Image
              </label>
              <div className="h-36 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg overflow-hidden border border-white/10 relative group">
                {editImage ? (
                  <img src={editImage} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                    <ImageIcon size={32} className="mb-2" />
                    <span className="text-sm">No image</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                >
                  {imageUploading ? (
                    <span className="text-white text-sm">Uploading...</span>
                  ) : (
                    <div className="flex items-center gap-2 text-white text-sm">
                      <Upload size={18} />
                      <span>{editImage ? 'Change Image' : 'Upload Image'}</span>
                    </div>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-4">
              {/* Available Toggle */}
              <GlassPanel level="surface" className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm">Available</h3>
                  <p className="text-xs text-gray-400">Visible to customers</p>
                </div>
                <button
                  onClick={() => setEditAvailable(!editAvailable)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    editAvailable ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      editAvailable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </GlassPanel>

              {/* Hot Toggle */}
              <GlassPanel level="surface" className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm">Hot Item</h3>
                  <p className="text-xs text-gray-400">Mark as hot food</p>
                </div>
                <button
                  onClick={() => setEditHot(!editHot)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    editHot ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      editHot ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </GlassPanel>
            </div>
          </div>

          {/* Footer */}
          <div className="glass-header sticky bottom-0 p-6 flex items-center justify-between">
            <div>
              {item && onDeleteMenuItem && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                >
                  <Trash2 size={18} />
                  Delete Item
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="glass-button px-6 py-2 rounded-lg">
                Cancel
              </button>
              <button onClick={handleSaveChanges} className="glass-button-primary px-6 py-2 rounded-lg">
                {item ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>
    );
  }

  // Render View Mode (default - for adding to cart)
  if (!item) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <GlassPanel
        level="modal"
        className="max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={{ padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="glass-header sticky top-0 flex items-center justify-between p-6">
          <h2 className="text-2xl font-bold text-white">{item.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          <div className="h-48 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg overflow-hidden border border-white/10">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <span>No image available</span>
              </div>
            )}
          </div>

          {/* Item Info */}
          <div>
            <p className="text-gray-400 mb-2">
              {item.hot && (
                <span className="inline-block text-xs bg-red-500/20 text-red-400 rounded px-2 py-1 mr-2 border border-red-500/30">
                  Hot
                </span>
              )}
            </p>
            <p className="text-3xl font-bold text-blue-400">${item.price.toFixed(2)}</p>
          </div>

          {/* Modifier Groups */}
          {(item.modifierGroups || [])
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(group => {
              const selectionCount = getGroupSelectionCount(group.modifiers);
              const isRadio = group.maxSelections === 1;
              const limitReached = group.maxSelections !== null && selectionCount >= group.maxSelections && !isRadio;
              const unmet = group.required && selectionCount < group.minSelections;

              return (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                    {group.required && (
                      <span className="text-xs bg-red-500/20 text-red-400 rounded px-2 py-0.5 border border-red-500/30">
                        Required
                      </span>
                    )}
                    {!isRadio && group.maxSelections !== null && (
                      <span className="text-xs text-gray-400">
                        ({selectionCount}/{group.maxSelections} selected)
                      </span>
                    )}
                  </div>
                  {unmet && (
                    <p className="text-xs text-red-400 mb-2">
                      Please select at least {group.minSelections} option{group.minSelections > 1 ? 's' : ''}
                    </p>
                  )}
                  <div className="space-y-2">
                    {group.modifiers.map(modifier => {
                      const isSelected = selectedModifiers.includes(modifier.name);
                      const isDisabled = !isSelected && limitReached;

                      return (
                        <label
                          key={modifier.id}
                          className={`flex items-center gap-3 p-3 glass-order-card rounded-lg transition ${
                            isDisabled
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-white/10 cursor-pointer'
                          }`}
                        >
                          <input
                            type={isRadio ? 'radio' : 'checkbox'}
                            name={isRadio ? `group-${group.id}` : undefined}
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => handleToggleGroupModifier(modifier.name, group)}
                            className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-white">{modifier.name}</p>
                          </div>
                          {modifier.price > 0 && (
                            <p className="text-blue-400 font-semibold">+${modifier.price.toFixed(2)}</p>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {/* Ungrouped Modifiers */}
          {ungroupedModifiers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Add-ons</h3>
              <div className="space-y-2">
                {ungroupedModifiers.map(modifier => (
                  <label
                    key={modifier.id}
                    className="flex items-center gap-3 p-3 glass-order-card rounded-lg hover:bg-white/10 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModifiers.includes(modifier.name)}
                      onChange={() => handleToggleModifier(modifier.name)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">{modifier.name}</p>
                    </div>
                    <p className="text-blue-400 font-semibold">+${modifier.price.toFixed(2)}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-gray-300 mb-3">Quantity</p>
            <div className="flex items-center gap-4 w-fit">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full glass-button flex items-center justify-center"
              >
                <Minus size={18} />
              </button>
              <span className="text-xl font-semibold w-8 text-center text-white">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full glass-button flex items-center justify-center"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Total and Add Button */}
        <div className="glass-header sticky bottom-0 p-6 flex items-center justify-between gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">Total Price</p>
            <p className="text-2xl font-bold text-blue-400">${totalPrice.toFixed(2)}</p>
          </div>
          <button onClick={handleAddToCart} className="glass-button-primary flex-1 py-3 text-lg rounded-lg">
            Add to Cart
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
