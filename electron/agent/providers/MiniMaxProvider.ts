import { OpenAIProvider } from './OpenAIProvider';

export class MiniMaxProvider extends OpenAIProvider {
    getProviderName(): string {
        return 'minimax';
    }
}

