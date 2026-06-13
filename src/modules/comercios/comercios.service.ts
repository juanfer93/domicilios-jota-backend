import { Injectable } from '@nestjs/common';
import { ComerciosRepository } from './repositories/comercios.repository';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { Comercio } from './entities/comercio.entity';

@Injectable()
export class ComerciosService {
  constructor(private readonly comerciosRepository: ComerciosRepository) {}

  async create(createComercioDto: CreateComercioDto): Promise<Comercio> {
    const comercio = this.comerciosRepository.create(createComercioDto);
    return this.comerciosRepository.save(comercio);
  }

  async findAll(): Promise<Comercio[]> {
    return this.comerciosRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  async search(nombre: string): Promise<Comercio[]> {
    return this.comerciosRepository.findByNombre(nombre);
  }

}
