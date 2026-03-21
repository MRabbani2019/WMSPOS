import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package } from 'lucide-react';
import TopBar from '../components/TopBar';
import apiClient from '../lib/axios';

export default function StockLookup() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await apiClient.get('/client/catalogue/list/1', {
        params: { genSearch: true, genSearchValue: searchTerm, take: 20 },
      });
      const data = response.data?.data || response.data?.catalogues || [];
      const mapped = (Array.isArray(data) ? data : []).map((cat: any) => ({
        id: cat.id,
        name: cat.name || '',
        sku: cat.Variations?.[0]?.sku || cat.sku || '',
        barcode: cat.Variations?.[0]?.eanNo || '',
        image: cat.image || null,
        price: parseFloat(cat.basePrice || 0),
        stock: cat.totalStock ?? cat.Variations?.reduce((s: number, v: any) => s + (v.actualQuantity || 0), 0) ?? 0,
      }));
      setProducts(mapped);
    } catch (error) {
      console.error('Failed to search stock:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Stock Lookup</h1>
          </div>

          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by SKU, barcode, or product name..."
                  className="input-field pl-10"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {products.length > 0 ? (
            <div className="grid gap-4">
              {products.map((product) => (
                <div key={product.id} className="card">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                      <p className="text-sm text-gray-500">Barcode: {product.barcode || 'N/A'}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="font-semibold text-lg">£{product.price.toFixed(2)}</p>
                        <p className={`text-sm ${product.stock > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          Stock: {product.stock}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Search for products to view stock levels</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
