import { useState, useEffect } from 'react';
import { X, User, Tag, StickyNote, Trash2, Mail, Phone, Calendar } from 'lucide-react';
import apiClient from '../lib/axios';

interface CustomerProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  tags: string[];
  notes: string;
  marketingOptIn: boolean;
  lifetimeSpend: number;
  totalOrders: number;
  averageOrderValue: number;
  lastPurchasedAt: string | null;
  storeCredit: number;
  loyaltyPoints: number;
}

interface PurchaseHistoryItem {
  id: number;
  orderNumber: string;
  date: string;
  total: number;
  status: string;
  itemCount: number;
}

interface CustomerProfileModalProps {
  customerId: number;
  onClose: () => void;
}

export default function CustomerProfileModal({ customerId, onClose }: CustomerProfileModalProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [purchases, setPurchases] = useState<PurchaseHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'notes'>('overview');
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    loadProfile();
    loadPurchaseHistory();
  }, [customerId]);

  const loadProfile = async () => {
    try {
      const response = await apiClient.get(`/client/customer/${customerId}`);
      const data = response.data?.data || response.data;
      setProfile({
        id: data.id,
        firstName: data.billingFirstName || data.firstName || '',
        lastName: data.billingLastName || data.lastName || '',
        email: data.billingEmail || data.email || '',
        phone: data.billingPhone || data.phone || '',
        dateOfBirth: data.dateOfBirth || undefined,
        tags: data.tags || [],
        notes: data.notes || '',
        marketingOptIn: data.marketingOptIn || false,
        lifetimeSpend: parseFloat(data.lifetimeSpend) || 0,
        totalOrders: data.totalOrders || 0,
        averageOrderValue: parseFloat(data.averageOrderValue) || 0,
        lastPurchasedAt: data.lastPurchasedAt || null,
        storeCredit: parseFloat(data.storeCredit) || 0,
        loyaltyPoints: data.loyaltyPoints || 0,
      });
      setNoteText(data.notes || '');
    } catch (err) {
      console.error('Failed to load customer profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseHistory = async () => {
    try {
      const response = await apiClient.get(`/client/pos/customer/${customerId}/purchases`);
      const data = response.data?.data || response.data?.purchases || [];
      setPurchases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load purchase history:', err);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/client/customer/${customerId}`, { notes: noteText });
      if (profile) setProfile({ ...profile, notes: noteText });
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !profile) return;
    const updatedTags = [...profile.tags, newTag.trim()];
    try {
      await apiClient.put(`/client/customer/${customerId}`, { tags: updatedTags });
      setProfile({ ...profile, tags: updatedTags });
      setNewTag('');
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!profile) return;
    const updatedTags = profile.tags.filter((t) => t !== tag);
    try {
      await apiClient.put(`/client/customer/${customerId}`, { tags: updatedTags });
      setProfile({ ...profile, tags: updatedTags });
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const handleGdprDelete = async () => {
    if (!confirm('GDPR Right to Erasure: This will permanently anonymise all personal data for this customer. Financial records will be retained with a pseudonymous ID. This action is IRREVERSIBLE. Continue?')) {
      return;
    }
    try {
      await apiClient.post(`/client/customer/${customerId}/gdpr-delete`);
      onClose();
    } catch (err) {
      console.error('GDPR delete failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed top-0 right-0 bottom-0 w-[560px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center p-8" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed top-0 right-0 bottom-0 w-[560px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{profile.firstName} {profile.lastName}</h2>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                {profile.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {profile.email}</span>}
                {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {profile.phone}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8C9196] hover:text-[#202223]">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-gray-50 border-b border-[#E1E3E5]">
          <div className="text-center">
            <p className="text-xs text-gray-500">Lifetime Spend</p>
            <p className="font-bold text-lg">£{profile.lifetimeSpend.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Orders</p>
            <p className="font-bold text-lg">{profile.totalOrders}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Avg. Order</p>
            <p className="font-bold text-lg">£{profile.averageOrderValue.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Store Credit</p>
            <p className="font-bold text-lg text-success-600">£{profile.storeCredit.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E1E3E5]">
          {(['overview', 'history', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Tags */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Tag className="w-4 h-4" /> Tags
                </h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {profile.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700"
                    >
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-primary-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add tag..."
                    className="input-field text-sm flex-1"
                  />
                  <button onClick={handleAddTag} disabled={!newTag.trim()} className="btn-secondary text-sm">
                    Add
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                {profile.dateOfBirth && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    DOB: {new Date(profile.dateOfBirth).toLocaleDateString('en-GB')}
                  </div>
                )}
                {profile.lastPurchasedAt && (
                  <div className="text-sm text-gray-600">
                    Last purchase: {new Date(profile.lastPurchasedAt).toLocaleDateString('en-GB')}
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  Marketing: {profile.marketingOptIn ? 'Opted in' : 'Opted out'}
                </div>
                {profile.loyaltyPoints > 0 && (
                  <div className="text-sm text-gray-600">
                    Loyalty: {profile.loyaltyPoints} points
                  </div>
                )}
              </div>

              {/* GDPR */}
              <div className="pt-4 border-t border-[#E1E3E5]">
                <button
                  onClick={handleGdprDelete}
                  className="text-xs text-danger-600 hover:text-danger-800 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  GDPR: Delete Customer Data
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {purchases.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No purchase history</p>
              ) : (
                purchases.map((purchase) => (
                  <div key={purchase.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{purchase.orderNumber}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(purchase.date).toLocaleDateString('en-GB')} - {purchase.itemCount} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">£{purchase.total.toFixed(2)}</p>
                      <p className={`text-xs ${purchase.status === 'completed' ? 'text-success-600' : 'text-gray-500'}`}>
                        {purchase.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="input-field h-40 resize-none"
                placeholder="Add notes about this customer..."
              />
              <button
                onClick={handleSaveNotes}
                disabled={saving || noteText === profile.notes}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
