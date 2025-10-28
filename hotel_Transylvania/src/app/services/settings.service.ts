import { Injectable } from '@angular/core';

export type ChatFabSide = 'right' | 'left';
export type ScrollerSpeed = 'slow' | 'normal' | 'fast';

export interface AppSettings {
  highContrast: boolean;
  enableChatShortcut: boolean;
  toolbarGradient: boolean;
  chatFabSide: ChatFabSide;
  scrollerSpeed: ScrollerSpeed;
  companyAddress: string;
}

const STORAGE_KEY = 'app-settings-v1';

const defaults: AppSettings = {
  highContrast: false,
  enableChatShortcut: true,
  toolbarGradient: true,
  chatFabSide: 'right',
  scrollerSpeed: 'normal',
  companyAddress: '',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settings: AppSettings = { ...defaults };

  constructor() {
    this.load();
    this.apply();
  }

  get(): AppSettings { return { ...this.settings }; }

  set(partial: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.save();
    this.apply();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = { ...defaults, ...parsed } as AppSettings;
      }
    } catch { this.settings = { ...defaults }; }
  }

  private save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch {}
  }

  private apply() {
    const root = document.documentElement;
    // Dark mode: repurpose existing highContrast flag as dark theme
    root.classList.toggle('theme-dark', !!this.settings.highContrast);
    // Toolbar gradient toggle
    root.classList.toggle('no-toolbar-gradient', !this.settings.toolbarGradient);
    // Chat FAB side via CSS vars and class toggles
    root.style.setProperty('--chat-fab-side', this.settings.chatFabSide);
    // Scroller speed via CSS var
    const duration = this.settings.scrollerSpeed === 'slow' ? '55s' : this.settings.scrollerSpeed === 'fast' ? '28s' : '40s';
    root.style.setProperty('--scroller-duration', duration);
  }
}
