import { DomainError } from '@huddle/shared-kernel';
import { OAuthProviderName, User } from '../../domain/user.entity';
import { UserRepository } from '../ports/user.repository.port';

export interface OAuthLoginInput {
  provider: OAuthProviderName;
  providerId: string;
  email: string;
  emailVerifiedByProvider: boolean;
}

export class OAuthLoginUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: OAuthLoginInput): Promise<User> {
    const { provider, providerId, email, emailVerifiedByProvider } = input;

    const existingByProvider = await this.userRepository.findByOAuthProvider(
      provider,
      providerId,
    );
    if (existingByProvider) {
      return existingByProvider;
    }

    const existingByEmail = await this.userRepository.findByEmail(email);
    if (existingByEmail) {
      if (!emailVerifiedByProvider) {
        throw new DomainError(
          'Cannot link OAuth provider: email is not verified by the provider',
        );
      }
      if (!existingByEmail.isEmailVerified()) {
        throw new DomainError(
          'Cannot link OAuth provider: existing account email is not verified',
        );
      }

      existingByEmail.linkOAuthProvider(provider, providerId);
      await this.userRepository.save(existingByEmail);
      return existingByEmail;
    }

    const { user } = User.registerViaOAuth(email, provider, providerId);
    await this.userRepository.save(user);
    return user;
  }
}
