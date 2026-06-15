export interface CasoIaProvider {
  generateJson(prompt: string): Promise<string>;
  getProviderName(): string;
  getModelName(): string;
  isConfigured(): boolean;
}
