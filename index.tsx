/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, ChartOptions } from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);


// --- Interfaces and Types ---
interface Product {
  mpn: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  releaseDate: string; // YYYY-MM-DD
  status: 'Concept' | 'In Development' | 'Launched' | 'Discontinued';
  hasDrawing: boolean;
  shippingStatus: 'On Time' | 'Delayed' | 'Shipped';
  imageUrl: string;
  aiContent: {
    insideScoop: string;
    stylingTips: string;
  };
}

interface MonitoredSource {
    id: string;
    sourceType: 'RSS' | 'API';
    sourceValue: string; // URL
    status: 'active' | 'paused';
    keywords: string; // For rules engine
}

interface IngestionLogEntry {
    sourceId: string;
    sourceValue: string;
    status: 'success' | 'failure';
    result: string;
}

interface ProcessingLogEntry {
    id: string;
    sourceValue: string;
    status: 'processing' | 'skipped' | 'success' | 'failure';
    details: string;
}

interface ProcessedInsight {
    id: string;
    sourceValue: string;
    ingestedAt: string; // ISO string
    originalContent: string;
    aiAnalysis: {
        summary: string;
        sentiment: 'Positive' | 'Negative' | 'Neutral';
        entities: string[];
    };
}


interface Activity {
  id: string;
  timestamp: string; // ISO string
  description: string;
  points: number;
}

interface EngagementStats {
  userId: string;
  totalPoints: number;
  weeklyPoints: number;
  badges: string[];
  launchesViewed: number;
  activityFeed: Activity[];
}


type ProductFormData = Omit<Product, 'price' | 'shippingStatus' | 'imageUrl'> & {
  price: string;
};

type UserRole = 'store' | 'admin' | 'leadership';

interface User {
  name: string;
  role: UserRole;
}

// --- Mock Data ---
const initialProducts: Product[] = [
  {
    mpn: 'DZ5485-400',
    name: "Air Jordan 1 Retro High OG 'UNC Toe'",
    brand: 'Jordan Brand',
    description: "A tribute to Michael Jordan's alma mater, the 'UNC Toe' colorway is part of a legendary lineage. It uses the iconic 'Black Toe' color blocking but swaps the traditional red for a vibrant University Blue, creating one of the most anticipated Jordan 1 releases of the year.",
    price: 180.00,
    releaseDate: '2025-07-26',
    status: 'In Development',
    hasDrawing: true,
    shippingStatus: 'On Time',
    imageUrl: `https://picsum.photos/seed/DZ5485-400/400/300`,
    aiContent: {
        insideScoop: "A tribute to Michael Jordan's alma mater, the 'UNC Toe' colorway is part of a legendary lineage. It uses the iconic 'Black Toe' color blocking but swaps the traditional red for a vibrant University Blue, creating one of the most anticipated Jordan 1 releases of the year.",
        stylingTips: "The bold University Blue heel makes this a statement piece. Pair it with neutral-colored joggers (like gray or black) to let the shoe pop. For a classic look, cuff a pair of light-wash denim jeans just above the high-top collar."
    }
  },
  {
    mpn: 'DV0831-109',
    name: "Nike Dunk Low Retro 'Satin Green'",
    brand: 'Nike',
    description: "Originally a basketball shoe from 1985, the Dunk has become a streetwear staple. This 'Satin Green' edition elevates the classic silhouette with a luxurious satin material, offering a fresh, premium take on the iconic 'Be True to Your School' colorways.",
    price: 125.00,
    releaseDate: '2025-07-28',
    status: 'In Development',
    hasDrawing: false,
    shippingStatus: 'On Time',
    imageUrl: `https://picsum.photos/seed/DV0831-109/400/300`,
     aiContent: {
        insideScoop: "Originally a basketball shoe from 1985, the Dunk has become a streetwear staple. This 'Satin Green' edition elevates the classic silhouette with a luxurious satin material, offering a fresh, premium take on the iconic 'Be True to Your School' colorways.",
        stylingTips: "The satin finish adds a touch of luxury. These work well with both casual shorts and more elevated streetwear looks. Try them with pleated trousers or a clean, monochrome tracksuit to play off the premium material."
    }
  },
  {
    mpn: 'FD2596-107',
    name: "Wmns Air Jordan 1 Retro High OG 'UNC'",
    brand: 'Jordan Brand',
    description: "This women's exclusive release features a subtle, textured leather inspired by the original 1985 design. The colorway pays homage to a legendary career, offering a sophisticated and clean look that has made it a highly sought-after pair for all sneaker enthusiasts.",
    price: 180.00,
    releaseDate: '2025-08-04',
    status: 'In Development',
    hasDrawing: true,
    shippingStatus: 'On Time',
    imageUrl: `https://picsum.photos/seed/FD2596-107/400/300`,
    aiContent: {
        insideScoop: "This women's exclusive release features a subtle, textured leather inspired by the original 1985 design. The colorway pays homage to a legendary career, offering a sophisticated and clean look that has made it a highly sought-after pair for all sneaker enthusiasts.",
        stylingTips: "The clean white and blue palette is incredibly versatile. These look great with wide-leg light-wash jeans for a relaxed vibe or can be dressed up with a casual summer dress or skirt."
    }
  },
];

const mockMonitoredSources: MonitoredSource[] = [
    { id: 'src-1', sourceType: 'RSS', sourceValue: 'https://sneakernews.com/feed/', status: 'active', keywords: 'jordan, nike, unc' },
    { id: 'src-2', sourceType: 'RSS', sourceValue: 'https://hypebeast.com/footwear/feed', status: 'active', keywords: 'adidas, yeezy' },
    { id: 'src-3', sourceType: 'API', sourceValue: 'https://api.stockx.com/v2/sneakers', status: 'paused', keywords: '' },
    { id: 'src-4', sourceType: 'RSS', sourceValue: 'https://www.complex.com/sneakers/rss', status: 'active', keywords: '' },
];


const mockActivities: Activity[] = [
  { id: '1', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), description: "Customer Scan for Air Jordan 1 'UNC Toe'", points: 25 },
  { id: '2', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), description: "Knowledge Check: Nike Dunk Low 'Satin Green'", points: 15 },
  { id: '3', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), description: "Viewed Launch: Wmns Air Jordan 1 Retro High OG 'UNC'", points: 5 },
  { id: '4', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), description: "Customer Scan for Air Jordan 1 'UNC Toe'", points: 25 },
];

const mockEngagementData: EngagementStats = {
  userId: "zL8t4rYqP2fG...",
  totalPoints: 150,
  weeklyPoints: 65,
  badges: ["Day One", "Hype Master", "Sneakerhead"],
  launchesViewed: 12,
  activityFeed: mockActivities,
};

// Mock data for Leadership Dashboard
const mockLeadershipData = {
    kpis: {
        totalActiveEmployees: 1204,
        companyWideAvgPoints: 85,
        totalQRScansThisMonth: 5623,
    },
    leaderboard: [
        { id: 'S-101', name: 'Downtown Flagship', points: 12500, region: 'West' },
        { id: 'S-205', name: 'Westside Galleria', points: 11800, region: 'West' },
        { id: 'S-310', name: 'Northpark Mall', points: 10500, region: 'Southwest' },
        { id: 'S-102', name: 'City Creek', points: 9800, region: 'Midwest' },
        { id: 'S-415', name: 'Eastwood Center', points: 9200, region: 'Northeast' },
        { id: 'S-520', name: 'Lenox Square', points: 8900, region: 'Southeast' },
        { id: 'S-311', name: 'The Domain', points: 8500, region: 'Southwest' },
    ],
    regionalPerformance: {
        labels: ['West', 'Southwest', 'Midwest', 'Northeast', 'Southeast'],
        datasets: [{
            label: 'Weekly Points',
            data: [18000, 15500, 12000, 16200, 14800],
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
        }],
    },
    launchTrends: {
        labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        datasets: [{
            label: 'New Launches',
            data: [8, 12, 10, 15, 18, 25],
            fill: false,
            borderColor: 'rgb(245, 158, 11)',
            tension: 0.1,
        }],
    },
};


const API_KEY = process.env.API_KEY;
let ai;
if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
}

// --- Helper Functions ---
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC' // Treat date as UTC
  });
};

const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return `Yesterday`;
    if (days < 7) return `${days} days ago`;

    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
};

// --- New Auth & Shell Components ---

const LoadingScreen = () => (
    <div className="loading-screen">
        <div className="spinner"></div>
        <p>Initializing Secure Shell...</p>
    </div>
);

const AuthPage = ({ onLogin }: { onLogin: (role: UserRole) => void }) => (
    <div className="auth-page">
        <div className="auth-container">
            <h1>Launch Control</h1>
            <p>Please sign in to continue.</p>
            <div className="auth-actions">
                <button className="btn-primary" onClick={() => onLogin('store')}>Login as Store Staff</button>
                <button className="btn-primary" onClick={() => onLogin('admin')}>Login as Admin</button>
                <button className="btn-primary" onClick={() => onLogin('leadership')}>Login as Leadership</button>
            </div>
        </div>
    </div>
);

const AccessDenied = () => (
    <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page. Please contact your administrator.</p>
    </div>
);

const ErrorDisplay = ({ message, onRetry }: { message: string; onRetry: () => void; }) => (
    <div className="error-display">
        <div className="error-icon">⚠️</div>
        <h2>Oops! Something went wrong.</h2>
        <p>{message}</p>
        <button className="btn-primary" onClick={onRetry}>Try Again</button>
    </div>
);


// --- Loading Skeleton Components ---
const AdminSkeletonCard = () => (
    <article className="product-card skeleton-card" aria-label="Loading product">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-subtitle"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text skeleton-text-short"></div>
        <div className="skeleton-footer">
            <div className="skeleton skeleton-text" style={{ width: '30%', height: '1rem' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '20%', height: '1.25rem' }}></div>
        </div>
        <div className="skeleton-actions">
            <div className="skeleton skeleton-button"></div>
            <div className="skeleton skeleton-button"></div>
        </div>
    </article>
);

const StoreSkeletonCard = () => (
    <div className="store-skeleton-card"></div>
);


// --- Admin Components ---

const ProductFormModal = ({
  product,
  onSave,
  onCancel,
}: {
  product: Product,
  onSave: (product: Product) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({ ...product, price: String(product.price) });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleChange = ( e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.mpn || !formData.price || !formData.releaseDate || !formData.brand) {
      setError('All fields except description are required.');
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price)) {
      setError('Price must be a valid number.');
      return;
    }
    onSave({
      ...formData,
      price,
      // If imageUrl is empty (which it is for new products via emptyProduct),
      // generate one. Otherwise, keep the existing one.
      imageUrl: formData.imageUrl || `https://picsum.photos/seed/${formData.mpn}/400/300`,
    });
  };
  
  const handleGenerateAiContent = async () => {
    if (!ai || !formData.name) {
      setError('API key is not set or product name is missing.');
      return;
    }
    setIsGenerating(true);
    setError('');
    try {
      const prompt = `# ROLE:
You are an expert fashion marketing copywriter specializing in sneaker culture.

# TASK:
Your task is to generate comprehensive and engaging marketing content for a new sneaker release. The content should be structured in JSON format.

# CONTEXT:
- **promptVersion:** 1.1
- **Current Date:** ${new Date().toLocaleDateString()}
- **Product Name:** ${formData.name}
- **Brand:** ${formData.brand}
- **Release Date:** ${formatDate(formData.releaseDate)}

# OUTPUT STRUCTURE AND INSTRUCTIONS:
Generate a JSON object with the following keys: "description", "insideScoop", and "stylingTips".
- "description": A compelling, one-paragraph product description.
- "insideScoop": A paragraph sharing an interesting fact, historical context, or unique design detail about the shoe.
- "stylingTips": A paragraph with advice on how to style the sneakers with different outfits.
`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              insideScoop: { type: Type.STRING },
              stylingTips: { type: Type.STRING },
            },
            required: ['description', 'insideScoop', 'stylingTips']
          }
        }
      });

      const parsedContent = JSON.parse(response.text);
      setFormData(prev => ({
        ...prev,
        description: parsedContent.description,
        aiContent: {
          insideScoop: parsedContent.insideScoop,
          stylingTips: parsedContent.stylingTips,
        },
      }));

    } catch (err) {
      console.error('Error generating AI content:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Failed to generate AI content. ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return ( <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title"> <div className="modal-content"> <form onSubmit={handleSubmit}> <h2 id="modal-title">{product.mpn ? 'Edit Product' : 'Add New Product'}</h2><div className="form-group"> <label htmlFor="name">Product Name</label> <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required /> </div><div className="form-row"> <div className="form-group"> <label htmlFor="brand">Brand</label> <input type="text" id="brand" name="brand" value={formData.brand} onChange={handleChange} required /> </div><div className="form-group"> <label htmlFor="mpn">MPN</label> <input type="text" id="mpn" name="mpn" value={formData.mpn} onChange={handleChange} required disabled={!!product.mpn} /> </div></div><div className="form-group"> <label htmlFor="description">Description</label> <textarea id="description" name="description" value={formData.description} onChange={handleChange} /> </div>{ai && <div className="ai-button-container"> <button type="button" className="btn-secondary" onClick={handleGenerateAiContent} disabled={isGenerating || !formData.name}> {isGenerating ? <div className="spinner" /> : '✨ Generate AI Content'} </button> <button type="button" className="btn-secondary" disabled>Create Quiz</button> </div>}<div className="form-row"> <div className="form-group"> <label htmlFor="price">Price</label> <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} required step="0.01" /> </div><div className="form-group"> <label htmlFor="releaseDate">Release Date</label> <input type="date" id="releaseDate" name="releaseDate" value={formData.releaseDate} onChange={handleChange} required /> </div></div><div className="form-row"> <div className="form-group"> <label htmlFor="status">Status</label> <select id="status" name="status" value={formData.status} onChange={handleChange}> <option value="Concept">Concept</option> <option value="In Development">In Development</option> <option value="Launched">Launched</option> <option value="Discontinued">Discontinued</option> </select> </div><div className="form-group form-group-checkbox"> <input type="checkbox" id="hasDrawing" name="hasDrawing" checked={formData.hasDrawing} onChange={handleChange} /> <label htmlFor="hasDrawing">Drawing Available</label> </div></div>{error && <p className="error-message">{error}</p>}<div className="form-actions"> <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button> <button type="submit" className="btn-primary">Save Product</button> </div></form> </div></div> );
};

const AdminProductCard = ({ product, onEdit, onDelete }: { product: Product; onEdit: (product: Product) => void; onDelete: (mpn: string) => void; }) => (
  <article className="product-card" aria-labelledby={`product-name-${product.mpn}`}>
    <div className="card-header"> <h2 id={`product-name-${product.mpn}`}>{product.name}</h2> <span className="status-badge" data-status={product.status.replace(/\s+/g, '-').toLowerCase()}>{product.status}</span> </div>
    <p className="mpn">Brand: {product.brand} | MPN: {product.mpn}</p>
    <p className="description">{product.description}</p>
    <div className="details"> <span>Released: {formatDate(product.releaseDate)}</span> <div className="card-meta"> {product.hasDrawing && <span className="drawing-indicator">Drawing</span>} <span className="price">${product.price.toFixed(2)}</span> </div></div>
    <div className="actions"> <button className="btn-secondary" onClick={() => onEdit(product)}>Edit</button> <button className="btn-danger" onClick={() => onDelete(product.mpn)}>Delete</button> </div>
  </article>
);

const ManageSourcesDashboard = ({
    sources, onAddSource, onToggleStatus, onDeleteSource,
    isIngesting, onRunIngestion, ingestionLog, lastIngestionTime,
    isProcessing, onProcessData, processingLog,
}) => {
    const [sourceType, setSourceType] = useState<'RSS' | 'API'>('RSS');
    const [sourceValue, setSourceValue] = useState('');
    const [keywords, setKeywords] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!sourceValue.trim()) {
            alert('Source URL cannot be empty.');
            return;
        }
        onAddSource({
            id: `src-${new Date().getTime()}`,
            sourceType,
            sourceValue,
            status: 'active',
            keywords,
        });
        setSourceValue('');
        setKeywords('');
    };

    return (
        <div className="manage-sources-container">
            <div className="ingestion-control-panel">
                <div>
                    <h3>Automated Ingestion</h3>
                    <p>Simulate the backend cloud function that fetches data from active sources.</p>
                     {lastIngestionTime && (
                      <p className="last-run-status">
                        Last run: {formatRelativeTime(lastIngestionTime.toISOString())} &mdash; 
                        {ingestionLog.filter(l => l.status === 'success').length} processed, 
                        {ingestionLog.filter(l => l.status === 'failure').length} failed.
                      </p>
                    )}
                </div>
                <button className="btn-primary" onClick={onRunIngestion} disabled={isIngesting}>
                    {isIngesting ? <><div className="spinner" /> Ingesting...</> : 'Run Manual Ingestion'}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="add-source-form">
                <h3>Add New Monitored Source</h3>
                <div className="form-row">
                    <div className="form-group" style={{ flex: '0 1 150px' }}>
                        <label htmlFor="sourceType">Source Type</label>
                        <select id="sourceType" value={sourceType} onChange={e => setSourceType(e.target.value as 'RSS' | 'API')}>
                            <option value="RSS">RSS Feed</option>
                            <option value="API">API Endpoint</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ flex: '1 1 300px' }}>
                        <label htmlFor="sourceValue">Source URL</label>
                        <input type="text" id="sourceValue" value={sourceValue} onChange={e => setSourceValue(e.target.value)} placeholder="https://example.com/feed" />
                    </div>
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                        <label htmlFor="keywords">Filter Keywords (optional)</label>
                        <input type="text" id="keywords" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. nike, jordan" />
                    </div>
                    <div className="form-group form-actions-inline">
                         <button type="submit" className="btn-primary">Add Source</button>
                    </div>
                </div>
            </form>

            <div className="sources-table-container">
                <h3>Current Sources</h3>
                <table className="sources-table">
                    <thead>
                        <tr>
                            <th>Source</th>
                            <th>Keywords</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sources.length > 0 ? sources.map(source => (
                            <tr key={source.id}>
                                <td className="source-value"><strong>{source.sourceType}:</strong> {source.sourceValue}</td>
                                <td>{source.keywords || <span className="text-muted">None</span>}</td>
                                <td><span className="status-badge" data-status={source.status}>{source.status}</span></td>
                                <td className="actions">
                                    <button className="btn-secondary" onClick={() => onToggleStatus(source.id)}>
                                        {source.status === 'active' ? 'Pause' : 'Activate'}
                                    </button>
                                    <button className="btn-danger" onClick={() => onDeleteSource(source.id)}>Delete</button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4}>No monitored sources found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {ingestionLog.length > 0 && (
                <div className="ingestion-log-container">
                    <h3>Ingestion Log (Raw Data Pipeline)</h3>
                    <table className="ingestion-log-table">
                        <thead>
                            <tr>
                                <th>Source</th>
                                <th>Status</th>
                                <th>Result / Raw Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ingestionLog.map((log, i) => (
                                <tr key={log.sourceId + i}>
                                    <td className="source-value">{log.sourceValue}</td>
                                    <td><span className="status-badge" data-status={log.status}>{log.status}</span></td>
                                    <td className={`log-result ${log.status}`}>
                                        <pre><code>{log.result}</code></pre>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {lastIngestionTime && !isIngesting && (
                <div className="processing-control-panel">
                    <div className="panel-header">
                        <div>
                            <h3>Processing Core</h3>
                            <p>Simulate the event-driven function to filter, analyze, and enrich raw data.</p>
                        </div>
                         <button className="btn-primary" onClick={onProcessData} disabled={isProcessing}>
                            {isProcessing ? <><div className="spinner" /> Processing...</> : 'Process Raw Data'}
                        </button>
                    </div>

                    {processingLog.length > 0 && (
                        <div className="processing-log-wrapper">
                            <h4>Processing Status Log</h4>
                            <table className="processing-log-table">
                                <thead>
                                    <tr>
                                        <th>Source</th>
                                        <th>Status</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processingLog.map(log => (
                                        <tr key={log.id}>
                                            <td className="source-value">{log.sourceValue}</td>
                                            <td><span className="status-badge" data-status={log.status}>{log.status}</span></td>
                                            <td className={`log-result ${log.status}`}>{log.details}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const InsightCard = ({ insight }: { insight: ProcessedInsight }) => {
    const { sourceValue, ingestedAt, aiAnalysis } = insight;
    const { summary, sentiment, entities } = aiAnalysis;
    return (
        <article className="insight-card">
            <div className="insight-header">
                <p className="insight-source" title={sourceValue}>{sourceValue}</p>
                <span className={`insight-sentiment sentiment-${sentiment.toLowerCase()}`}>{sentiment}</span>
            </div>
            <div className="insight-body">
                <h4>AI Summary</h4>
                <p>{summary}</p>
            </div>
            {entities && entities.length > 0 && (
                <div className="insight-entities">
                    <h4>Key Entities</h4>
                    <div className="entity-tags">
                        {entities.map((e, i) => <span key={e + i} className="entity-tag">{e}</span>)}
                    </div>
                </div>
            )}
            <div className="insight-footer">
                <p>Processed: {formatRelativeTime(ingestedAt)}</p>
            </div>
        </article>
    );
};

const InsightsDashboard = ({ insights, isLoading }) => {
    if (isLoading) {
        return (
            <div className="insights-grid">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="insight-card skeleton">
                        <div className="skeleton skeleton-text" style={{width: '60%'}}></div>
                        <div className="skeleton skeleton-text" style={{height: '4rem'}}></div>
                        <div className="skeleton skeleton-text" style={{width: '80%'}}></div>
                    </div>
                ))}
            </div>
        );
    }
    
    if (insights.length === 0) {
        return (
            <div className="empty-state">
                <h3>No Insights Yet</h3>
                <p>Navigate to "Manage Sources", run ingestion, and then process the raw data to generate AI-powered insights.</p>
            </div>
        );
    }

    return (
        <div className="insights-grid">
            {insights.map(insight => <InsightCard key={insight.id} insight={insight} />)}
        </div>
    );
};


const AdminDashboard = ({ 
    products, onEditProduct, onDeleteProduct, onAddProduct,
    sources, onAddSource, onToggleSourceStatus, onDeleteSource, 
    isLoading,
    isIngesting, onRunIngestion, ingestionLog, lastIngestionTime,
    isProcessing, onProcessData, processingLog, processedInsights,
}) => {
    const [activeTab, setActiveTab] = useState<'products' | 'sources' | 'insights'>('products');

    return (
        <>
            <div className="admin-tabs">
                <button 
                    onClick={() => setActiveTab('products')} 
                    className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`}
                    aria-current={activeTab === 'products'}
                >
                    Manage Products
                </button>
                <button 
                    onClick={() => setActiveTab('sources')} 
                    className={`admin-tab ${activeTab === 'sources' ? 'active' : ''}`}
                    aria-current={activeTab === 'sources'}
                >
                    Manage Sources
                </button>
                 <button 
                    onClick={() => setActiveTab('insights')} 
                    className={`admin-tab ${activeTab === 'insights' ? 'active' : ''}`}
                    aria-current={activeTab === 'insights'}
                >
                    Insights
                </button>
            </div>
            {activeTab === 'products' && (
                <>
                    <div className="sub-header">
                        <p>Manage all products in the database.</p>
                        <button className="btn-primary" onClick={onAddProduct}>Add New Product</button>
                    </div>
                     {isLoading ? (
                        <div className="product-grid">
                            {Array.from({ length: 3 }).map((_, i) => <AdminSkeletonCard key={i} />)}
                        </div>
                     ) : products.length > 0 ? (
                        <div className="product-grid">
                            {products.map(product => (
                                <AdminProductCard key={product.mpn} product={product} onEdit={onEditProduct} onDelete={onDeleteProduct} />
                            ))}
                        </div>
                    ) : ( <p>No products found. Add one to get started!</p> )}
                </>
            )}
             {activeTab === 'sources' && (
                <ManageSourcesDashboard 
                    sources={sources} 
                    onAddSource={onAddSource} 
                    onToggleStatus={onToggleSourceStatus}
                    onDeleteSource={onDeleteSource}
                    isIngesting={isIngesting}
                    onRunIngestion={onRunIngestion}
                    ingestionLog={ingestionLog}
                    lastIngestionTime={lastIngestionTime}
                    isProcessing={isProcessing}
                    onProcessData={onProcessData}
                    processingLog={processingLog}
                />
            )}
            {activeTab === 'insights' && (
                <InsightsDashboard insights={processedInsights} isLoading={isLoading} />
            )}
        </>
    );
};


// --- Store Components ---

const HeadlineTicker = ({ products }: { products: Product[] }) => {
    const delayedProducts = products.filter(p => p.shippingStatus === 'Delayed');
    if (delayedProducts.length === 0) return null;

    return (
        <div className="ticker-wrap" aria-label="Urgent Updates">
            <div className="ticker-move">
                <div className="ticker-item">🚨 DELAYED:</div>
                {delayedProducts.map(p => (
                    <div key={p.mpn} className="ticker-item">{p.name}</div>
                ))}
            </div>
        </div>
    );
};

const StoreProductCard = ({ product, onClick }: { product: Product; onClick: (product: Product) => void; }) => (
    <article className="store-card" onClick={() => onClick(product)} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(product)}>
        <img src={product.imageUrl} alt={product.name} className="store-card-img" />
        <div className="store-card-overlay">
            <div className="store-card-header">
                <h3>{product.name}</h3>
                <p>{product.brand}</p>
            </div>
            <div className="store-card-footer">
                <span>{formatDate(product.releaseDate)}</span>
                <span className="shipping-status-badge" data-status={product.shippingStatus.replace(/\s+/g, '-').toLowerCase()}>{product.shippingStatus}</span>
            </div>
        </div>
    </article>
);

const QuizModal = ({ product, onComplete, onClose }: { product: Product; onComplete: (points: number) => void; onClose: () => void; }) => {
    const [answer, setAnswer] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        setSubmitted(true);
        const isCorrect = String(product.hasDrawing) === answer;
        if (isCorrect) {
            onComplete(15);
        }
    };

    const isCorrectAnswer = String(product.hasDrawing) === answer;

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="quiz-title">
            <div className="modal-content quiz-modal" onClick={e => e.stopPropagation()}>
                <div className="quiz-header">
                    <h2 id="quiz-title">Knowledge Check</h2>
                    <button className="btn-close" onClick={onClose} aria-label="Close">&times;</button>
                </div>
                <p className="quiz-product-name">{product.name}</p>
                <div className="quiz-question">
                    <p>This product has a drawing available for customers. True or False?</p>
                </div>
                <div className="quiz-answers">
                    <button onClick={() => setAnswer('true')} className={`quiz-answer-btn ${answer === 'true' ? 'selected' : ''}`} disabled={submitted}>True</button>
                    <button onClick={() => setAnswer('false')} className={`quiz-answer-btn ${answer === 'false' ? 'selected' : ''}`} disabled={submitted}>False</button>
                </div>
                {submitted && (
                    <div className={`quiz-feedback ${isCorrectAnswer ? 'correct' : 'incorrect'}`}>
                        {isCorrectAnswer ? "Correct! +15 points awarded." : "Incorrect. Better luck next time!"}
                    </div>
                )}
                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
                    <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!answer || submitted}>Submit</button>
                </div>
            </div>
        </div>
    );
};

const LaunchHubModal = ({ product, onClose, onTakeQuiz, onSimulateScan }: { product: Product | null; onClose: () => void; onTakeQuiz: (product: Product) => void; onSimulateScan: (product: Product) => void; }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'news' | 'styling'>('overview');
    if (!product) return null;

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="launchhub-title">
            <div className="modal-content launch-hub" onClick={e => e.stopPropagation()}>
                <div className="launch-hub-header">
                    <div>
                        <h2 id="launchhub-title">{product.name}</h2>
                        <p className="mpn">Brand: {product.brand} | MPN: {product.mpn}</p>
                    </div>
                    <button className="btn-close" onClick={onClose} aria-label="Close">&times;</button>
                </div>
                <div className="launch-hub-tabs">
                    <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>Overview</button>
                    <button onClick={() => setActiveTab('news')} className={activeTab === 'news' ? 'active' : ''}>News & Facts</button>
                    <button onClick={() => setActiveTab('styling')} className={activeTab === 'styling' ? 'active' : ''}>Styling Tips</button>
                </div>
                <div className="launch-hub-content">
                    {activeTab === 'overview' && (
                        <div>
                            <p className="description">{product.description}</p>
                            <div className="details">
                                <span><strong>Release Date:</strong> {formatDate(product.releaseDate)}</span>
                                <span className="price"><strong>Price:</strong> ${product.price.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                    {activeTab === 'news' && <p>{product.aiContent.insideScoop}</p>}
                    {activeTab === 'styling' && <p>{product.aiContent.stylingTips}</p>}
                </div>
                 <div className="launch-hub-actions">
                    <button type="button" className="btn-secondary" onClick={() => onSimulateScan(product)} disabled={!product.hasDrawing}>Simulate QR Scan</button>
                    <button type="button" className="btn-primary" onClick={() => onTakeQuiz(product)}>Take Quiz</button>
                    <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const AchievementsModal = ({ stats, onClose }: { stats: EngagementStats; onClose: () => void; }) => (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="achievements-title">
        <div className="modal-content achievements-modal" onClick={e => e.stopPropagation()}>
            <div className="achievements-header">
                <h2 id="achievements-title">My Achievements</h2>
                <button className="btn-close" onClick={onClose} aria-label="Close">&times;</button>
            </div>
            <div className="achievements-points">
                <div className="points-total">
                    <span className="points-value">{stats.totalPoints.toLocaleString()}</span>
                    <span className="points-label">Total Points</span>
                </div>
                <div className="points-weekly">
                    <span className="points-value">{stats.weeklyPoints.toLocaleString()}</span>
                    <span className="points-label">Weekly Points</span>
                </div>
            </div>
            <div className="achievements-badges">
                <h3>Badges Earned</h3>
                {stats.badges.length > 0 ? (
                    <div className="badge-grid">
                        {stats.badges.map(badge => (
                            <div key={badge} className="badge-item" title={badge}>
                                <span className="badge-icon">🏅</span>
                                <span className="badge-name">{badge}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>Start exploring launches to earn badges!</p>
                )}
            </div>
            <div className="achievements-feed">
                <h3>Recent Activity</h3>
                {stats.activityFeed.length > 0 ? (
                    <ul className="feed-list">
                        {stats.activityFeed.map(activity => (
                            <li key={activity.id} className="feed-item">
                                <div className="feed-item-points">+{activity.points} pts</div>
                                <div className="feed-item-details">
                                    <p className="feed-item-description">{activity.description}</p>
                                    <span className="feed-item-timestamp">{formatRelativeTime(activity.timestamp)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Your recent activity will show up here.</p>
                )}
            </div>
            <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            </div>
        </div>
    </div>
);


const StoreDashboard = ({ products, onCardClick, isLoading }) => {
    if (isLoading) {
        return (
             <div className="store-grid">
                {Array.from({ length: 6 }).map((_, i) => <StoreSkeletonCard key={i} />)}
            </div>
        )
    }

    const groupedProducts = products.reduce((acc, product) => {
        const date = product.releaseDate;
        if (!acc[date]) acc[date] = [];
        acc[date].push(product);
        return acc;
    }, {});
    const sortedDates = Object.keys(groupedProducts).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return (
        <>
            <HeadlineTicker products={products} />
            {sortedDates.map(date => (
                <section key={date} className="date-group" aria-labelledby={`date-header-${date}`}>
                    <h2 id={`date-header-${date}`} className="date-header">{formatDate(date)}</h2>
                    <div className="store-grid">
                        {groupedProducts[date].map(product => (
                            <StoreProductCard key={product.mpn} product={product} onClick={onCardClick} />
                        ))}
                    </div>
                </section>
            ))}
        </>
    );
};

// --- Leadership Dashboard Components ---
const LeadershipDashboard = ({ data, isLoading, onDateFilterChange, onRegionFilterChange, dateFilter, regionFilter }) => {
    const chartOptions: ChartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#9ca3af' },
            },
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#9ca3af' },
            },
        },
    };

    if (isLoading || !data) {
        return (
            <div className="dashboard-grid">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="dashboard-widget skeleton" style={{ height: '100px' }}></div>)}
                {Array.from({ length: 2 }).map((_, i) => <div key={i} className="dashboard-widget skeleton" style={{ height: '300px' }}></div>)}
            </div>
        )
    }

    return (
        <div className="leadership-dashboard">
            <div className="dashboard-filters">
                <select value={dateFilter} onChange={e => onDateFilterChange(e.target.value)}>
                    <option value="last-7-days">Last 7 Days</option>
                    <option value="last-30-days">Last 30 Days</option>
                    <option value="last-90-days">Last 90 Days</option>
                </select>
                <select value={regionFilter} onChange={e => onRegionFilterChange(e.target.value)}>
                    <option value="all-regions">All Regions</option>
                    <option value="West">West</option>
                    <option value="Southwest">Southwest</option>
                    <option value="Midwest">Midwest</option>
                    <option value="Northeast">Northeast</option>
                    <option value="Southeast">Southeast</option>
                </select>
            </div>

            <div className="kpi-bar">
                <div className="kpi-item">
                    <span className="kpi-value">{data.kpis.totalActiveEmployees.toLocaleString()}</span>
                    <span className="kpi-label">Total Active Employees</span>
                </div>
                <div className="kpi-item">
                    <span className="kpi-value">{data.kpis.companyWideAvgPoints.toLocaleString()}</span>
                    <span className="kpi-label">Company-Wide Avg. Points</span>
                </div>
                <div className="kpi-item">
                    <span className="kpi-value">{data.kpis.totalQRScansThisMonth.toLocaleString()}</span>
                    <span className="kpi-label">Total QR Scans This Month</span>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-widget">
                    <h3>Top Stores by Points</h3>
                    <ul className="leaderboard-list">
                        {data.leaderboard.map((store, index) => (
                            <li key={store.id} className="leaderboard-item">
                                <span className="leaderboard-rank">{index + 1}</span>
                                <span className="leaderboard-name">{store.name}</span>
                                <span className="leaderboard-points">{store.points.toLocaleString()} pts</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="dashboard-widget">
                    <h3>Regional Performance</h3>
                    <div className="chart-container">
                       <Bar options={chartOptions as ChartOptions<'bar'>} data={data.regionalPerformance} />
                    </div>
                </div>
                <div className="dashboard-widget full-width">
                    <h3>Launch Engagement Trends</h3>
                     <div className="chart-container">
                       <Line options={chartOptions as ChartOptions<'line'>} data={data.launchTrends} />
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Version Display Component ---
const VersionDisplay = () => {
  const appVersion = '3.5.0'; 
  return (
    <div className="version-display">
      <p>v{appVersion}</p>
    </div>
  );
};

// --- App Content (Main Application Logic) ---
const AppContent = ({ user, onLogout }: { user: User; onLogout: () => void; }) => {
  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [monitoredSources, setMonitoredSources] = useState<MonitoredSource[]>([]);
  const [engagementStats, setEngagementStats] = useState<EngagementStats | null>(null);
  
  // Control States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [launchHubProduct, setLaunchHubProduct] = useState<Product | null>(null);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizProduct, setQuizProduct] = useState<Product | null>(null);
  
  // Leadership Dashboard State
  const [leadershipData, setLeadershipData] = useState(null);
  const [displayedLeadershipData, setDisplayedLeadershipData] = useState(null);
  const [dateFilter, setDateFilter] = useState('last-30-days');
  const [regionFilter, setRegionFilter] = useState('all-regions');

  // AI Pipeline State
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionLog, setIngestionLog] = useState<IngestionLogEntry[]>([]);
  const [lastIngestionTime, setLastIngestionTime] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLog, setProcessingLog] = useState<ProcessingLogEntry[]>([]);
  const [processedInsights, setProcessedInsights] = useState<ProcessedInsight[]>([]);

  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (Math.random() < 0.2) { throw new Error("Failed to connect to the server."); }
        
        const sortedProducts = [...initialProducts].sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
        setProducts(sortedProducts);
        setMonitoredSources(mockMonitoredSources);
        setEngagementStats(mockEngagementData);
        setLeadershipData(mockLeadershipData);
        setDisplayedLeadershipData(mockLeadershipData);

    } catch (err) {
        console.error("Data fetching error:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred. Please try again.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Effect to filter leadership data
   useEffect(() => {
    if (!leadershipData) return;
    let filteredData = JSON.parse(JSON.stringify(leadershipData));
    if (regionFilter !== 'all-regions') {
        filteredData.leaderboard = filteredData.leaderboard.filter(store => store.region === regionFilter);
    }
    const hash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; 
      }
      return Math.abs(hash);
    };
    const seed = hash(dateFilter + regionFilter);
    filteredData.kpis.companyWideAvgPoints = 85 + (seed % 10) - 5;
    filteredData.kpis.totalQRScansThisMonth = 5623 + (seed % 500) - 250;
    filteredData.regionalPerformance.datasets[0].data = filteredData.regionalPerformance.datasets[0].data.map(d => d + (seed % 1000) - 500);
    filteredData.launchTrends.datasets[0].data = filteredData.launchTrends.datasets[0].data.map(d => d + (seed % 3) - 1);
    setDisplayedLeadershipData(filteredData);
  }, [dateFilter, regionFilter, leadershipData]);

  const getPageTitle = () => {
    switch (user.role) {
        case 'store': return 'Store Dashboard';
        case 'admin': return 'Launch Control';
        case 'leadership': return 'Leadership Dashboard';
        default: return 'Dashboard';
    }
  }

  // --- Product CRUD Functions ---
  const createProduct = (product: Product) => setProducts(prev => [product, ...prev]);
  const updateProduct = (updatedProduct: Product) => setProducts(prev => prev.map(p => (p.mpn === updatedProduct.mpn ? updatedProduct : p)));
  const deleteProduct = useCallback((mpn: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(prev => prev.filter(p => p.mpn !== mpn));
    }
  }, []);
  
  // --- Source CRUD Functions ---
  const addSource = (source: MonitoredSource) => setMonitoredSources(prev => [source, ...prev]);
  const toggleSourceStatus = (sourceId: string) => {
      setMonitoredSources(prev => prev.map(s => s.id === sourceId ? {...s, status: s.status === 'active' ? 'paused' : 'active'} : s));
  };
  const deleteSource = (sourceId: string) => {
      if (window.confirm('Are you sure you want to delete this monitored source?')) {
          setMonitoredSources(prev => prev.filter(s => s.id !== sourceId));
      }
  };

  // --- Ingestion Simulation ---
  const handleRunIngestion = async () => {
    setIsIngesting(true);
    setIngestionLog([]);
    setProcessingLog([]);
    setLastIngestionTime(null);

    const activeSources = monitoredSources.filter(s => s.status === 'active');
    const ingestionPromises = activeSources.map(source => {
        return new Promise<IngestionLogEntry>((resolve) => {
            setTimeout(() => {
                let resultText = '';
                if (source.sourceValue.includes('sneakernews')) {
                    resultText = `The iconic Nike Air Jordan 1 'UNC Toe' is releasing soon. This classic sneaker has a fresh colorway.`;
                } else if (source.sourceValue.includes('hypebeast')) {
                    resultText = `A review of the latest New Balance 990v6.`;
                } else if (source.sourceValue.includes('complex.com')) {
                    resultText = `ComplexCon announces its return with major brand partners.`;
                } else {
                     resultText = `Generic news item that will likely be filtered.`;
                }
                resolve({ sourceId: source.id, sourceValue: source.sourceValue, status: 'success', result: resultText });
            }, 500 + Math.random() * 500);
        });
    });
    const results = await Promise.all(ingestionPromises);
    setIngestionLog(results);
    setLastIngestionTime(new Date());
    setIsIngesting(false);
  };

  // --- Processing Simulation ---
  const handleProcessRawData = async () => {
    if (!ai) {
        alert("AI client is not initialized. Please check API Key.");
        return;
    }
    setIsProcessing(true);
    setProcessingLog([]);

    const successfulIngestion = ingestionLog.filter(log => log.status === 'success');
    const newInsights: ProcessedInsight[] = [];

    for (const logEntry of successfulIngestion) {
        const logId = `${logEntry.sourceId}-${Date.now()}`;
        setProcessingLog(prev => [...prev, { id: logId, sourceValue: logEntry.sourceValue, status: 'processing', details: 'Starting analysis...' }]);
        await new Promise(r => setTimeout(r, 200));

        const source = monitoredSources.find(s => s.id === logEntry.sourceId);
        if (!source) {
             setProcessingLog(prev => prev.map(l => l.id === logId ? { ...l, status: 'failure', details: 'Source configuration not found.' } : l));
             continue;
        }

        const keywords = source.keywords.split(',').map(k => k.trim()).filter(k => k);
        if (keywords.length > 0) {
            const hasKeyword = keywords.some(k => logEntry.result.toLowerCase().includes(k.toLowerCase()));
            if (!hasKeyword) {
                setProcessingLog(prev => prev.map(l => l.id === logId ? { ...l, status: 'skipped', details: `No matching keywords found (${source.keywords}).` } : l));
                await new Promise(r => setTimeout(r, 200));
                continue;
            }
        }
        
        setProcessingLog(prev => prev.map(l => l.id === logId ? { ...l, details: 'Keyword match found. Sending to AI...' } : l));
        await new Promise(r => setTimeout(r, 500));

        try {
            if (source.sourceValue.includes('complex.com')) {
                throw new Error("Simulated bad JSON response from AI to test hardened parsing.");
            }
            const prompt = `Analyze the following article content and return a JSON object. Content: "${logEntry.result}"`;
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash', contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "A brief summary of the article." },
                        sentiment: { type: Type.STRING, enum: ['Positive', 'Negative', 'Neutral'], description: "The overall sentiment." },
                        entities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key entities (brands, people, products)." }
                    },
                    required: ['summary', 'sentiment', 'entities']
                }
              }
            });
            
            let parsedAnalysis;
            try {
                parsedAnalysis = JSON.parse(response.text);
            } catch(parseError) {
                throw new Error(`AI returned malformed JSON. ${parseError.message}`);
            }
            
            newInsights.push({
                id: `insight-${Date.now()}-${Math.random()}`,
                sourceValue: logEntry.sourceValue,
                ingestedAt: new Date().toISOString(),
                originalContent: logEntry.result,
                aiAnalysis: parsedAnalysis
            });
            setProcessingLog(prev => prev.map(l => l.id === logId ? { ...l, status: 'success', details: 'Successfully processed and saved.' } : l));
        } catch (err) {
             setProcessingLog(prev => prev.map(l => l.id === logId ? { ...l, status: 'failure', details: `AI analysis failed: ${err.message}` } : l));
        }
    }
    
    setProcessedInsights(prev => [...prev, ...newInsights].sort((a,b) => new Date(b.ingestedAt).getTime() - new Date(a.ingestedAt).getTime()));
    setIsProcessing(false);
};


  // --- Modal Handlers ---
  const handleOpenFormModal = (product: Product | null = null) => { setEditingProduct(product); setIsFormModalOpen(true); };
  const handleCloseFormModal = () => { setIsFormModalOpen(false); setEditingProduct(null); };
  const handleSaveProduct = (product: Product) => {
      const existingProduct = products.find(p => p.mpn === product.mpn);
      if (existingProduct) { updateProduct(product); } else { createProduct(product); }
      setProducts(prev => [...prev].sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()));
      handleCloseFormModal();
  };

  const handleOpenLaunchHub = (product: Product) => setLaunchHubProduct(product);
  const handleCloseLaunchHub = () => setLaunchHubProduct(null);
  
  const handleOpenAchievementsModal = () => setIsAchievementsModalOpen(true);
  const handleCloseAchievementsModal = () => setIsAchievementsModalOpen(false);

  const handleOpenQuizModal = (product: Product) => {
    setQuizProduct(product);
    setIsQuizModalOpen(true);
    handleCloseLaunchHub();
  };
  const handleCloseQuizModal = () => setIsQuizModalOpen(false);

  const handleCompleteQuiz = (points: number) => {
    if (!quizProduct || !engagementStats) return;

    const newActivity: Activity = {
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      description: `Knowledge Check: ${quizProduct.name}`,
      points,
    };

    setEngagementStats(prev => {
        const stats = prev!;
        const newBadges = [...stats.badges];
        if (!newBadges.includes("Fast Learner")) {
            newBadges.push("Fast Learner");
        }
        return {
            ...stats,
            totalPoints: stats.totalPoints + points,
            weeklyPoints: stats.weeklyPoints + points,
            activityFeed: [newActivity, ...stats.activityFeed],
            badges: newBadges,
        };
    });
    
    setTimeout(() => {
        handleCloseQuizModal();
    }, 1500); // Wait a bit to show feedback
  };
  
  const handleSimulateQrScan = (product: Product) => {
    if (!engagementStats) return;
    const points = 25;
    const newActivity: Activity = {
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      description: `Customer Scan for ${product.name}`,
      points,
    };
     setEngagementStats(prev => {
        const stats = prev!;
        return {
            ...stats,
            totalPoints: stats.totalPoints + points,
            weeklyPoints: stats.weeklyPoints + points,
            activityFeed: [newActivity, ...stats.activityFeed],
        };
    });
    handleCloseLaunchHub();
  };


  const emptyProduct: Product = {
    mpn: '', name: '', brand: '', description: '', price: 0,
    releaseDate: new Date().toISOString().split('T')[0],
    status: 'Concept', hasDrawing: false, shippingStatus: 'On Time',
    imageUrl: '', aiContent: { insideScoop: '', stylingTips: '' }
  };

  return (
    <>
      <header>
        <div>
            <h1>{getPageTitle()}</h1>
        </div>
        <div className="header-controls">
          {user.role === 'store' && engagementStats && (
            <div 
              className="achievements-summary" 
              onClick={handleOpenAchievementsModal} 
              onKeyDown={(e) => e.key === 'Enter' && handleOpenAchievementsModal()}
              role="button" 
              tabIndex={0}
              aria-label={`View achievements. Current weekly points: ${engagementStats.weeklyPoints}`}
            >
                <span>🏆 {engagementStats.weeklyPoints.toLocaleString()} Weekly Points</span>
            </div>
           )}
          <div className="user-profile">
            <span>Welcome, {user.name}</span>
            <button className="btn-secondary" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main>
        {error ? (
          <ErrorDisplay message={error} onRetry={fetchData} />
        ) : (
          <>
            {user.role === 'store' && <StoreDashboard products={products} onCardClick={handleOpenLaunchHub} isLoading={isLoading} />}
            {user.role === 'admin' && <AdminDashboard 
                products={products} 
                onEditProduct={handleOpenFormModal} 
                onDeleteProduct={deleteProduct} 
                onAddProduct={() => handleOpenFormModal(null)} 
                sources={monitoredSources}
                onAddSource={addSource}
                onToggleSourceStatus={toggleSourceStatus}
                onDeleteSource={deleteSource}
                isLoading={isLoading} 
                isIngesting={isIngesting}
                onRunIngestion={handleRunIngestion}
                ingestionLog={ingestionLog}
                lastIngestionTime={lastIngestionTime}
                isProcessing={isProcessing}
                onProcessData={handleProcessRawData}
                processingLog={processingLog}
                processedInsights={processedInsights}
            />}
            {user.role === 'leadership' && <LeadershipDashboard data={displayedLeadershipData} isLoading={isLoading} dateFilter={dateFilter} regionFilter={regionFilter} onDateFilterChange={setDateFilter} onRegionFilterChange={setRegionFilter} />}
            {!['store', 'admin', 'leadership'].includes(user.role) && <AccessDenied />}
          </>
        )}
      </main>
      
      {isFormModalOpen && (
        <ProductFormModal
          product={editingProduct || emptyProduct}
          onSave={handleSaveProduct}
          onCancel={handleCloseFormModal}
        />
      )}

      <LaunchHubModal product={launchHubProduct} onClose={handleCloseLaunchHub} onTakeQuiz={handleOpenQuizModal} onSimulateScan={handleSimulateQrScan} />

      {isAchievementsModalOpen && engagementStats && (
        <AchievementsModal
            stats={engagementStats}
            onClose={handleCloseAchievementsModal}
        />
      )}
      
      {isQuizModalOpen && quizProduct && (
        <QuizModal
            product={quizProduct}
            onClose={handleCloseQuizModal}
            onComplete={handleCompleteQuiz}
        />
      )}

      <VersionDisplay />
    </>
  );
};

// --- Main App Component (Shell & Router) ---
const App = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    // Simulate onAuthStateChanged to determine initial auth state
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleLogin = (role: UserRole) => {
        setUser({ name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`, role });
    };

    const handleLogout = () => {
        setUser(null);
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <AuthPage onLogin={handleLogin} />;
    }

    return <AppContent user={user} onLogout={handleLogout} />;
};


const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}