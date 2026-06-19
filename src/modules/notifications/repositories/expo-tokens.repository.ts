import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ExpoTokenEntity } from '../entities/expo-token.entity';

@Injectable()
export class ExpoTokensRepository extends Repository<ExpoTokenEntity> {
  constructor(private dataSource: DataSource) {
    super(ExpoTokenEntity, dataSource.createEntityManager());
  }

  /**
   * Guarda o actualiza un token Expo para el usuario.
   * Si el token ya existe (único por endpoint), actualiza el usuarioId.
   */
  async upsertForUser(
    usuarioId: string,
    token: string,
    platform: 'android',
  ): Promise<ExpoTokenEntity> {
    const existing = await this.findOne({ where: { token } });

    if (existing) {
      existing.usuarioId = usuarioId;
      existing.platform = platform;
      return this.save(existing);
    }

    const created = this.create({ usuarioId, token, platform });
    return this.save(created);
  }

  async findByUser(usuarioId: string): Promise<ExpoTokenEntity[]> {
    return this.find({ where: { usuarioId, platform: 'android' } });
  }

  async deleteByToken(token: string): Promise<void> {
    await this.delete({ token });
  }
}
