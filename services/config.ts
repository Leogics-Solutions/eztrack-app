/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:8000';
export const API_VERSION = 'v1';
export const BASE_URL = `${API_BASE_URL}/api/${API_VERSION}`;











