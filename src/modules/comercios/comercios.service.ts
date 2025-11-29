import { Injectable, NotFoundException } from '@nestjs/common';
import { ComerciosRepository } from './repositories/comercios.repository';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { UpdateComercioDto } from './dto/update-comercio.dto';
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

  async findOne(id: string): Promise<Comercio> {
    const comercio = await this.comerciosRepository.findOne({ where: { id } });

    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }

    return comercio;
  }

  async search(nombre: string): Promise<Comercio[]> {
    return this.comerciosRepository.findByNombre(nombre);
  }

  async update(
    id: string,
    updateComercioDto: UpdateComercioDto,
  ): Promise<Comercio> {
    const comercio = await this.findOne(id);
    Object.assign(comercio, updateComercioDto);
    return this.comerciosRepository.save(comercio);
  }

  async remove(id: string): Promise<void> {
    const comercio = await this.findOne(id);
    await this.comerciosRepository.remove(comercio);
  }
}