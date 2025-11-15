import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

// Simple selective preloading strategy: only preload routes with
// `data: { preload: true }`. This reduces background network work
// compared with PreloadAllModules and improves initial load.
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    try {
      return route.data && route.data['preload'] ? load() : of(null);
    } catch (e) {
      return of(null);
    }
  }
}
