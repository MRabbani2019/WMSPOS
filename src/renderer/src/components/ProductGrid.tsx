import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Package, Eye, EyeOff, MapPin, X, CheckCircle } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import apiClient from '../lib/axios';

interface Category {
  id: number;
  name: string;
}

interface WarehouseStock {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
}

export default function ProductGrid() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [hideOutOfStock, setHideOutOfStock] = useState(true);
  const [stockModal, setStockModal] = useState<{ product: any; stocks: WarehouseStock[]; loading: boolean } | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ name: string; sku: string } | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const terminalConfig = useAuthStore((state) => state.terminalConfig);
  const getTaxRateForProduct = useSettingsStore((state) => state.getTaxRateForProduct);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanFeedbackTimer = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    loadCategories();
  }, []);

  // Keep input focused — but only when no modal is open
  useEffect(() => {
    const refocus = (e: MouseEvent) => {
      // Don't steal focus if a modal overlay is open (any fixed z-50 element)
      const target = e.target as HTMLElement;
      if (target.closest('.fixed.inset-0') || target.closest('[role="dialog"]')) return;
      if (!stockModal && inputRef.current) {
        inputRef.current.focus();
      }
    };
    window.addEventListener('click', refocus);
    return () => {
      window.removeEventListener('click', refocus);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current);
    };
  }, [stockModal]);

  const loadCategories = async () => {
    try {
      const response = await apiClient.get('/client/categorization-data');
      const all = response.data?.data || [];
      const cats = all
        .filter((c: any) => c.categorizationId === 6 && c.status === 1)
        .map((c: any) => ({ id: c.id, name: c.name }));
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchProducts = useCallback(async (term: string, categoryId: number | null) => {
    if (!term.trim() && !categoryId) {
      setProducts([]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const params: any = {
        categoryId: categoryId || 'null',
        warehouseId: terminalConfig?.warehouseId,
      };
      if (term.trim()) params.searchData = term;

      const response = await apiClient.get('/client/catalogue/pos/data', { params, signal: abortRef.current.signal });
      const data = response.data?.data || [];
      const mapped = (Array.isArray(data) ? data : []).flatMap(mapCatalogueToProducts);
      setProducts(mapped);
      return mapped;
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') return [];
      console.error('Failed to search products:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [terminalConfig?.warehouseId]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(term, activeCategory), 300);
  };

  // Barcode scan: Enter key triggers instant lookup + auto-add
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const term = searchTerm.trim();
    if (!term) return;

    // Cancel any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Check if this looks like a barcode (all digits) or exact SKU (has _ or .)
    const isBarcode = /^\d+$/.test(term);
    const isSku = term.includes('_') || term.includes('.');

    if (isBarcode || isSku) {
      setLoading(true);
      try {
        const response = await apiClient.get('/client/catalogue/pos/data', {
          params: {
            searchData: term,
            categoryId: 'null',
            warehouseId: terminalConfig?.warehouseId,
          },
        });
        const data = response.data?.data || [];
        const mapped = (Array.isArray(data) ? data : []).flatMap(mapCatalogueToProducts);

        if (mapped.length === 1 && mapped[0].shelfStock > 0) {
          // Exact match found — auto-add to cart
          handleAddToCart(mapped[0]);
          showScanFeedback(mapped[0]);
          setSearchTerm('');
          setProducts([]);
        } else if (mapped.length === 1 && mapped[0].shelfStock <= 0) {
          // Found but out of stock
          setProducts(mapped);
        } else {
          // Multiple or no results — show grid
          setProducts(mapped);
        }
      } catch (error) {
        console.error('Barcode lookup failed:', error);
      } finally {
        setLoading(false);
      }
    } else {
      // Regular text search on Enter — just do the search immediately
      fetchProducts(term, activeCategory);
    }
  };

  const showScanFeedback = (product: any) => {
    if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current);
    setScanFeedback({ name: product.name, sku: product.sku });
    scanFeedbackTimer.current = setTimeout(() => setScanFeedback(null), 2000);
  };

  const handleCategoryClick = (categoryId: number | null) => {
    setActiveCategory(categoryId);
    setSearchTerm('');
    if (categoryId) {
      fetchProducts('', categoryId);
    } else {
      setProducts([]);
    }
  };

  const mapCatalogueToProducts = (cat: any) => {
    if (cat.Variations && cat.Variations.length > 0) {
      return cat.Variations.map((v: any) => ({
        variationId: v.id,
        catalogueId: v.catalogueId || cat.id,
        sku: v.sku || '',
        name: cat.name || v.sku || '',
        image: v.image || cat.image || null,
        price: parseFloat(v.salePrice || cat.salePrice || 0),
        shelfStock: v.shelfStock ?? 0,
        totalStock: v.actualQuantity ?? 0,
      }));
    }
    return [{
      variationId: cat.id,
      catalogueId: cat.id,
      sku: '',
      name: cat.name || '',
      image: cat.image || null,
      price: parseFloat(cat.salePrice || 0),
      shelfStock: 0,
      totalStock: 0,
    }];
  };

  const handleAddToCart = (product: any) => {
    const taxRate = getTaxRateForProduct(product.variationId, product.catalogueId);
    addItem({
      variationId: product.variationId,
      catalogueId: product.catalogueId,
      sku: product.sku,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: 1,
      maxStock: product.shelfStock,
      taxRate,
    });
  };

  const handleViewStores = async (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    setStockModal({ product, stocks: [], loading: true });
    try {
      const response = await apiClient.get(`/client/pos/stock/${product.variationId}/warehouses`);
      setStockModal({ product, stocks: response.data?.data || [], loading: false });
    } catch (err) {
      console.error('Failed to fetch warehouse stock:', err);
      setStockModal({ product, stocks: [], loading: false });
    }
  };

  const getStockLabel = (product: any) => {
    if (product.shelfStock > 0) {
      return { text: `${product.shelfStock} in store`, badge: 'badge-success' };
    }
    if (product.totalStock > 0) {
      return { text: `Other stores (${product.totalStock})`, badge: 'badge-warning' };
    }
    return { text: 'Out of stock', badge: 'badge-danger' };
  };

  const visibleProducts = hideOutOfStock
    ? products.filter((p) => p.shelfStock > 0)
    : products;

  return (
    <div>
      {/* Scan feedback toast */}
      {scanFeedback && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-primary-500 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5" />
          <div>
            <p className="font-medium text-sm">Added to cart</p>
            <p className="text-xs opacity-90">{scanFeedback.sku || scanFeedback.name}</p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products by name, SKU, or barcode..."
            className="input-field pl-10"
            autoFocus
          />
        </div>
        <button
          onClick={() => setHideOutOfStock(!hideOutOfStock)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium border transition-colors whitespace-nowrap ${
            hideOutOfStock
              ? 'bg-primary-50 border-primary-200 text-primary-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
          title={hideOutOfStock ? 'Showing in-stock only' : 'Showing all products'}
        >
          {hideOutOfStock ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {hideOutOfStock ? 'In stock' : 'All'}
        </button>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-0 border-b border-[#E1E3E5] mb-5 overflow-x-auto">
          <button
            onClick={() => handleCategoryClick(null)}
            className={activeCategory === null ? 'category-tab-active' : 'category-tab'}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={activeCategory === cat.id ? 'category-tab-active' : 'category-tab'}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Searching...</p>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-[#C9CCCF] mx-auto mb-4" />
          <p className="text-[#6D7175]">
            {searchTerm || activeCategory
              ? hideOutOfStock && products.length > 0
                ? `${products.length} product${products.length > 1 ? 's' : ''} found but out of stock in this store`
                : 'No products found'
              : 'Search by name, SKU, or scan a barcode'}
          </p>
          {hideOutOfStock && products.length > 0 && (
            <button
              onClick={() => setHideOutOfStock(false)}
              className="mt-2 text-primary-600 text-sm hover:underline"
            >
              Show out of stock items
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleProducts.map((product) => {
            const stock = getStockLabel(product);
            return (
              <div key={product.variationId} className="bg-white rounded-xl border border-[#E1E3E5] p-3 text-left hover:-translate-y-0.5 hover:shadow-md hover:border-[#C9CCCF] transition-all duration-150">
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={product.shelfStock <= 0}
                  className="w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="aspect-square bg-[#F6F6F7] rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2 text-[#202223]">{product.name}</h3>
                  <p className="text-xs text-[#8C9196] mb-2">{product.sku}</p>
                  <p className="font-bold text-base text-[#202223]">£{product.price.toFixed(2)}</p>
                </button>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs ${stock.badge}`}>{stock.text}</span>
                  <button
                    onClick={(e) => handleViewStores(e, product)}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-0.5"
                  >
                    <MapPin className="w-3 h-3" />
                    Stores
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Warehouse stock modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setStockModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
              <div>
                <h3 className="font-semibold text-sm">Stock Availability</h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{stockModal.product.name}</p>
                <p className="text-xs text-gray-400">{stockModal.product.sku}</p>
              </div>
              <button onClick={() => setStockModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {stockModal.loading ? (
                <p className="text-gray-500 text-sm text-center py-4">Loading...</p>
              ) : stockModal.stocks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No stock found in any location</p>
              ) : (
                <div className="space-y-2">
                  {stockModal.stocks.map((wh) => {
                    const isCurrentStore = wh.warehouseId === terminalConfig?.warehouseId;
                    return (
                      <div
                        key={wh.warehouseId}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isCurrentStore ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className={`w-4 h-4 ${isCurrentStore ? 'text-primary-600' : 'text-gray-400'}`} />
                          <div>
                            <p className={`text-sm font-medium ${isCurrentStore ? 'text-primary-700' : 'text-gray-700'}`}>
                              {wh.warehouseName}
                            </p>
                            {isCurrentStore && (
                              <p className="text-xs text-primary-500">This store</p>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${
                          wh.quantity > 0 ? 'text-success-600' : 'text-danger-600'
                        }`}>
                          {wh.quantity}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E1E3E5] mt-3">
                    <span className="text-sm font-medium text-gray-700">Total</span>
                    <span className="text-sm font-bold">
                      {stockModal.stocks.reduce((sum, wh) => sum + wh.quantity, 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
