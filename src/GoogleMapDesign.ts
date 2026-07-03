import type { MapDesignTypeInterface } from '@mapconductor/core';

export type GoogleMapDesignType = MapDesignTypeInterface<string>;

export namespace GoogleMapDesign {
  export const Normal: GoogleMapDesignType = { id: 'roadmap', getValue: () => 'roadmap' };
  export const Satellite: GoogleMapDesignType = { id: 'satellite', getValue: () => 'satellite' };
  export const Hybrid: GoogleMapDesignType = { id: 'hybrid', getValue: () => 'hybrid' };
  export const Terrain: GoogleMapDesignType = { id: 'terrain', getValue: () => 'terrain' };
  export const None: GoogleMapDesignType = { id: 'none', getValue: () => 'none' };

  export function Create(id: string): GoogleMapDesignType {
    switch (id) {
      case 'roadmap': return Normal;
      case 'satellite': return Satellite;
      case 'hybrid': return Hybrid;
      case 'terrain': return Terrain;
      case 'none': return None;
      default: return { id, getValue: () => id };
    }
  }
}
