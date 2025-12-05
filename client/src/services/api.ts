import axios, { AxiosInstance } from 'axios';
import type {
  ApiResponse,
  ClientCreateResponse,
  Project,
  Theme,
  Content,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ValidationRequest,
  ValidationResponse,
} from '../types';

class ApiClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor(baseURL: string = '/api') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load API key from localStorage on init
    this.loadApiKey();

    // Add request interceptor to include API key
    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers.Authorization = `Bearer ${this.apiKey}`;
      }
      return config;
    });
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    localStorage.setItem('brandforge_api_key', apiKey);
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    localStorage.removeItem('brandforge_api_key');
  }

  private loadApiKey() {
    const stored = localStorage.getItem('brandforge_api_key');
    if (stored) {
      this.apiKey = stored;
    }
  }

  // Client endpoints
  async createClient(name: string): Promise<ApiResponse<ClientCreateResponse>> {
    const response = await this.client.post<ApiResponse<ClientCreateResponse>>(
      '/clients/create',
      { name }
    );
    return response.data;
  }

  // Project endpoints
  async createProject(project: Partial<Project>): Promise<ApiResponse<Project>> {
    const response = await this.client.post<ApiResponse<Project>>(
      '/projects/create',
      project
    );
    return response.data;
  }

  async getProjects(): Promise<ApiResponse<Project[]>> {
    const response = await this.client.get<ApiResponse<Project[]>>('/projects');
    return response.data;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<ApiResponse<Project>> {
    const response = await this.client.put<ApiResponse<Project>>(
      `/projects/${id}`,
      updates
    );
    return response.data;
  }

  // Theme endpoints
  async createTheme(theme: Partial<Theme>): Promise<ApiResponse<Theme>> {
    const response = await this.client.post<ApiResponse<Theme>>(
      '/themes/create',
      theme
    );
    return response.data;
  }

  async getThemes(): Promise<ApiResponse<Theme[]>> {
    const response = await this.client.get<ApiResponse<Theme[]>>('/themes');
    return response.data;
  }

  // Content endpoints
  async getContent(projectId: string): Promise<ApiResponse<Content[]>> {
    const response = await this.client.get<ApiResponse<Content[]>>(
      `/contents/${projectId}`
    );
    return response.data;
  }

  // Text generation
  async generateText(request: TextGenerationRequest): Promise<ApiResponse<TextGenerationResponse>> {
    const response = await this.client.post<ApiResponse<TextGenerationResponse>>(
      '/text/generate',
      request
    );
    return response.data;
  }

  // Image generation
  async generateImage(request: ImageGenerationRequest): Promise<ApiResponse<ImageGenerationResponse>> {
    const response = await this.client.post<ApiResponse<ImageGenerationResponse>>(
      '/images/generate',
      request
    );
    return response.data;
  }

  // Validation
  async validateContent(request: ValidationRequest): Promise<ApiResponse<ValidationResponse>> {
    const response = await this.client.post<ApiResponse<ValidationResponse>>(
      '/validate',
      request
    );
    return response.data;
  }

  // Health check
  async testVertex(): Promise<ApiResponse<string>> {
    const response = await this.client.get<ApiResponse<string>>('/vertex-test');
    return response.data;
  }

  // Validate API key by making a test request to a protected endpoint
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Create a temporary axios instance with the test API key
      const tempClient = axios.create({
        baseURL: this.client.defaults.baseURL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      // Make a test request to a protected endpoint
      const response = await tempClient.get<ApiResponse<Project[]>>('/projects');
      
      // If we get a successful response, the key is valid
      return response.status === 200 && response.data.success;
    } catch (error: any) {
      // Check if it's an auth error
      if (error.response) {
        const status = error.response.status;
        // 401 = no auth, 403 = invalid auth
        if (status === 401 || status === 403) {
          return false;
        }
      }
      // For other errors (network, etc.), we'll return false to be safe
      return false;
    }
  }
}

export const apiClient = new ApiClient();

