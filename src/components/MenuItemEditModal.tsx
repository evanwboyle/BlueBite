import { useState, useEffect } from 'react';
import type { MenuItem, Modifier } from '../types';
import { X, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { GlassPanel } from './ui';

interface MenuItemEditModalProps {
  item: MenuItem | null; // null = create mode
  onClose: () => void;
  onSave: (id: string, updates: Partial<MenuItem>) => void;
  onCreate: (item: Omit<MenuItem, 'id'>) => void;
  onDelete?: (id: string) => void;
  butteryOptions: Array<{ name: string; itemCount: number }>;
}

interface ValidationErrors {
  name?: string;
  price?: string;
  category?: string;
}

export function MenuItemEditModal({
  item,
  onClose,
  onSave,
  onCreate,
  onDelete,
  butteryOptions,
}: MenuItemEditModalProps) {
  const isCreateMode = item === null;

  // Form state
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [price, setPrice] = useState(item?.price.toString() || '');
  const [category, setCategory] = useState(item?.category || '');
  const [image, setImage] = useState(item?.image || '');
  const [hot, setHot] = useState(item?.hot || false);
  const [disabled, setDisabled] = useState(item?.disabled || false);
  const [buttery, setButtery] = useState(item?.buttery || '');
  const [modifiers, setModifiers] = useState<Modifier[]>(item?.modifiers || []);

  // Modifier edit state
  const [editingModifierId, setEditingModifierId] = useState<string | null>(null);
  const [editingModifierName, setEditingModifierName] = useState('');
  const [editingModifierPrice, setEditingModifierPrice] = useState('');
  const [editingModifierDescription, setEditingModifierDescription] = useState('');

  // Validation state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state when item changes
  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || '');
      setPrice(item.price.toString());
      setCategory(item.category);
      setImage(item.image || '');
      setHot(item.hot);
      setDisabled(item.disabled);
      setButtery(item.buttery || '');
      setModifiers(item.modifiers);
    }
  }, [item]);

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }

    if (!category.trim()) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    const updates: Partial<MenuItem> = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: parseFloat(price),
      category: category.trim(),
      image: image.trim() || undefined,
      hot,
      disabled,
      buttery: buttery.trim() || null,
      modifiers,
    };

    if (isCreateMode) {
      onCreate(updates as Omit<MenuItem, 'id'>);
    } else {
      onSave(item.id, updates);
    }

    onClose();
  };

  const handleAddModifier = () => {
    const newModifier: Modifier = {
      id: `mod_${Date.now()}`,
      name: 'New Modifier',
      price: 0,
      description: '',
    };
    setModifiers([...modifiers, newModifier]);
    setEditingModifierId(newModifier.id);
    setEditingModifierName(newModifier.name);
    setEditingModifierPrice('0');
    setEditingModifierDescription('');
  };

  const handleStartEditModifier = (modifier: Modifier) => {
    setEditingModifierId(modifier.id);
    setEditingModifierName(modifier.name);
    setEditingModifierPrice(modifier.price.toString());
    setEditingModifierDescription(modifier.description || '');
  };

  const handleSaveModifier = () => {
    if (!editingModifierId) return;

    const modifierPrice = parseFloat(editingModifierPrice);
    if (!editingModifierName.trim() || isNaN(modifierPrice) || modifierPrice < 0) {
      alert('Modifier must have a valid name and price (>= 0)');
      return;
    }

    setModifiers(
      modifiers.map((m) =>
        m.id === editingModifierId
          ? {
              ...m,
              name: editingModifierName.trim(),
              price: modifierPrice,
              description: editingModifierDescription.trim() || undefined,
            }
          : m
      )
    );

    setEditingModifierId(null);
    setEditingModifierName('');
    setEditingModifierPrice('');
    setEditingModifierDescription('');
  };

  const handleCancelEditModifier = () => {
    // If it's a newly added modifier with default values, remove it
    if (editingModifierId) {
      const modifier = modifiers.find((m) => m.id === editingModifierId);
      if (modifier && modifier.name === 'New Modifier' && modifier.price === 0) {
        setModifiers(modifiers.filter((m) => m.id !== editingModifierId));
      }
    }

    setEditingModifierId(null);
    setEditingModifierName('');
    setEditingModifierPrice('');
    setEditingModifierDescription('');
  };

  const handleDeleteModifier = (modifierId: string) => {
    setModifiers(modifiers.filter((m) => m.id !== modifierId));
    if (editingModifierId === modifierId) {
      setEditingModifierId(null);
    }
  };

  const handleDelete = () => {
    if (!item || !onDelete) return;
    onDelete(item.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <GlassPanel
        level="modal"
        className="max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        style={{ padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="sticky top-0 glass-header flex items-center justify-between p-6 z-10">
          <h2 className="text-2xl font-bold text-white">
            {isCreateMode ? 'New Menu Item' : `Edit: ${item.name}`}
          </h2>
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
          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Image URL (Optional)
            </label>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {image && (
              <div className="mt-3 h-32 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg overflow-hidden border border-white/10">
                <img
                  src={image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '';
                    e.currentTarget.classList.add('hidden');
                  }}
                />
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              placeholder="Item name"
              className={`w-full px-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-white/10'
              }`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Item description"
              rows={3}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Price and Category Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Price <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    if (errors.price) setErrors({ ...errors, price: undefined });
                  }}
                  placeholder="0.00"
                  className={`w-full pl-8 pr-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.price ? 'border-red-500' : 'border-white/10'
                  }`}
                />
              </div>
              {errors.price && <p className="mt-1 text-sm text-red-400">{errors.price}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (errors.category) setErrors({ ...errors, category: undefined });
                }}
                placeholder="e.g., Snacks, Drinks"
                className={`w-full px-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.category ? 'border-red-500' : 'border-white/10'
                }`}
              />
              {errors.category && <p className="mt-1 text-sm text-red-400">{errors.category}</p>}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hot}
                onChange={(e) => setHot(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-300">
                Hot Item{' '}
                <span className="inline-block text-xs bg-red-500/20 text-red-400 rounded px-2 py-1 ml-1 border border-red-500/30">
                  Hot
                </span>
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!disabled}
                onChange={(e) => setDisabled(!e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-300">Available</span>
            </label>
          </div>

          {/* Buttery Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Buttery (Optional)
            </label>
            <select
              value={buttery}
              onChange={(e) => setButtery(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None</option>
              {butteryOptions.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name} ({option.itemCount} items)
                </option>
              ))}
            </select>
          </div>

          {/* Modifiers Section */}
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Modifiers</h3>
              <button
                onClick={handleAddModifier}
                className="glass-button-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              >
                <Plus size={16} />
                Add Modifier
              </button>
            </div>

            {modifiers.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">
                No modifiers added. Click "Add Modifier" to create one.
              </p>
            ) : (
              <div className="space-y-3">
                {modifiers.map((modifier) => (
                  <GlassPanel
                    key={modifier.id}
                    level="surface"
                  >
                    {editingModifierId === modifier.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div>
                          <input
                            type="text"
                            value={editingModifierName}
                            onChange={(e) => setEditingModifierName(e.target.value)}
                            placeholder="Modifier name"
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <textarea
                            value={editingModifierDescription}
                            onChange={(e) => setEditingModifierDescription(e.target.value)}
                            placeholder="Description (optional)"
                            rows={2}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                              $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingModifierPrice}
                              onChange={(e) => setEditingModifierPrice(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <button
                            onClick={handleSaveModifier}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600/30 text-green-400 border border-green-500/50 rounded-lg hover:bg-green-600/40 transition text-sm font-medium"
                          >
                            <Save size={14} />
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditModifier}
                            className="glass-button px-3 py-2 rounded-lg text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">{modifier.name}</p>
                          {modifier.description && (
                            <p className="text-sm text-gray-400 mt-1">{modifier.description}</p>
                          )}
                          <p className="text-blue-400 font-semibold mt-1">
                            +${modifier.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleStartEditModifier(modifier)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-2 rounded transition"
                            aria-label="Edit modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteModifier(modifier.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded transition"
                            aria-label="Delete modifier"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </GlassPanel>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Action Buttons */}
        <div className="sticky bottom-0 glass-header p-6 flex items-center justify-between gap-4">
          <div className="flex gap-3">
            {!isCreateMode && onDelete && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/40 transition font-medium"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="glass-button px-4 py-2 rounded-lg font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/40 transition font-medium"
                  >
                    <Trash2 size={18} />
                    Delete
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="glass-button px-6 py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="glass-button-primary px-6 py-2 rounded-lg font-medium"
            >
              {isCreateMode ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
