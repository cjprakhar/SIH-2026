/**
 * SIF Intelligence API Client Service
 * Connects to FastAPI backend at http://localhost:8000
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function fetchJSON(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errorDetail = 'API request failed';
      try {
        const errorData = await res.json();
        errorDetail = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch (e) {
        errorDetail = `HTTP ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorDetail);
    }

    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // System
  getHealth: () => fetchJSON('/health'),
  getIndexStatus: () => fetchJSON('/index/status'),
  buildIndex: (forceRebuild = false, batchSize = 512) =>
    fetchJSON('/index/build', {
      method: 'POST',
      body: JSON.stringify({ force_rebuild: forceRebuild, batch_size: batchSize }),
    }),

  // Analysis
  analyzeReport: (text) =>
    fetchJSON('/analyze', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  analyzeBatch: (reports) =>
    fetchJSON('/analyze/batch', {
      method: 'POST',
      body: JSON.stringify({ reports }),
    }),

  // Semantic Similarity Search
  findSimilar: (query, topK = 5, minSimilarity = 0.35, sourceType = null) =>
    fetchJSON('/similar', {
      method: 'POST',
      body: JSON.stringify({
        query,
        top_k: topK,
        min_similarity: minSimilarity,
        source_type: sourceType || null,
      }),
    }),

  // Safety Patterns
  getGlobalPatterns: (topN = 15) => fetchJSON(`/patterns?top_n=${topN}`),
  searchPatterns: (query, topK = 5) =>
    fetchJSON('/patterns/search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    }),
  getPatternById: (patternId) => fetchJSON(`/patterns/${encodeURIComponent(patternId)}`),

  // Insights
  getInsights: (refresh = false) => fetchJSON(`/insights?refresh=${refresh}`),

  // Reports
  getReports: (limit = 50, offset = 0, sourceType = null) => {
    let endpoint = `/reports?limit=${limit}&offset=${offset}`;
    if (sourceType) {
      endpoint += `&source_type=${encodeURIComponent(sourceType)}`;
    }
    return fetchJSON(endpoint);
  },
  getReportById: (reportId) => fetchJSON(`/reports/${encodeURIComponent(reportId)}`),
};

export default api;
