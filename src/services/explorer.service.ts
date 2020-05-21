import { Injectable, Type } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { ModulesContainer } from '@nestjs/core/injector/modules-container';
import {
  COMMAND_HANDLER_METADATA,
  EVENTS_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
  SAGA_METADATA,
} from '../decorators/constants';
import {
  ICommandHandler,
  IEvent,
  IEventHandler,
  IQueryHandler,
} from '../interfaces';
import { CqrsOptions } from '../interfaces/cqrs-options.interface';

@Injectable()
export class ExplorerService<EventBase extends IEvent = IEvent> {
  constructor(private readonly modulesContainer: ModulesContainer) {}

  private cqrsOptions: CqrsOptions;

  explore(): CqrsOptions {
    if (this.cqrsOptions) {
      return this.cqrsOptions;
    }

    const modules = [...this.modulesContainer.values()];
    const commands = this.flatMap<ICommandHandler>(modules, (instance) =>
      this.filterProvider(instance, COMMAND_HANDLER_METADATA),
    );
    const queries = this.flatMap<IQueryHandler>(modules, (instance) =>
      this.filterProvider(instance, QUERY_HANDLER_METADATA),
    );
    const events = this.flatMap<IEventHandler<EventBase>>(modules, (instance) =>
      this.filterProvider(instance, EVENTS_HANDLER_METADATA),
    );
    const sagas = this.flatMap(modules, (instance) =>
      this.filterProvider(instance, SAGA_METADATA),
    );

    const commandDtos = commands.map(c => Reflect.getMetadata(COMMAND_HANDLER_METADATA, c));
    const eventDtos = commands.map(e => Reflect.getMetadata(EVENTS_HANDLER_METADATA, e));
    const queryDtos = commands.map(q => Reflect.getMetadata(QUERY_HANDLER_METADATA, q));

    this.cqrsOptions = { commands, queries, events, sagas, commandDtos, eventDtos, queryDtos };
    return this.cqrsOptions;
  }

  flatMap<T>(
    modules: Module[],
    callback: (instance: InstanceWrapper) => Type<any> | undefined,
  ): Type<T>[] {
    const items = modules
      .map((module) => [...module.providers.values()].map(callback))
      .reduce((a, b) => a.concat(b), []);
    return items.filter((element) => !!element) as Type<T>[];
  }

  filterProvider(
    wrapper: InstanceWrapper,
    metadataKey: string,
  ): Type<any> | undefined {
    const { instance } = wrapper;
    if (!instance) {
      return undefined;
    }
    return this.extractMetadata(instance, metadataKey);
  }

  extractMetadata(
    instance: Record<string, any>,
    metadataKey: string,
  ): Type<any> {
    if (!instance.constructor) {
      return;
    }
    const metadata = Reflect.getMetadata(metadataKey, instance.constructor);
    return metadata ? (instance.constructor as Type<any>) : undefined;
  }
}
