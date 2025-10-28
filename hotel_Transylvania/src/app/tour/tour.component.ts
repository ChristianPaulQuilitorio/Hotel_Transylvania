import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Step { selector: string; title: string; body: string; centerCard?: boolean; }

@Component({
  standalone: true,
  selector: 'app-tour',
  imports: [CommonModule],
  styles: [`
  .tour-overlay { position: fixed; inset: 0; background: transparent; z-index: 1059; }
  .tour-hole { position: fixed; z-index: 1060; border: 2px solid #fff; border-radius: 10px; box-shadow: 0 0 0 9999px rgba(0,0,0,.55); pointer-events: auto; }
  .tour-card { position: fixed; max-width: 320px; z-index: 1061; background:#fff; color:#222; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.25); }
  .tour-card .hdr { padding:10px 12px; font-weight:600; border-bottom:1px solid rgba(0,0,0,.1); }
  .tour-card .bd { padding:10px 12px; font-size:14px; }
  .tour-card .ft { padding:10px 12px; display:flex; gap:8px; justify-content:space-between; align-items:center; }
  :root.theme-dark .tour-card { background:#2b2b2b; color:#e7e7e7; }
  :root.theme-dark .tour-hole { border-color:#ffd; box-shadow:0 0 0 9999px rgba(0,0,0,.7); }
  `],
  template: `
  <ng-container *ngIf="active">
    <div class="tour-overlay" (click)="skip()"></div>
    <div class="tour-hole" [ngStyle]="holeStyle"></div>
    <div class="tour-card" [ngStyle]="cardStyle" role="dialog" aria-modal="true" aria-live="polite">
      <div class="hdr">{{ step?.title }}</div>
      <div class="bd">{{ step?.body }}</div>
      <div class="ft">
        <div class="small text-muted">Step {{ index+1 }} / {{ steps.length }}</div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" (click)="prev()" [disabled]="index===0">Back</button>
          <button class="btn btn-sm btn-primary" (click)="next()">{{ index===steps.length-1 ? 'Finish' : 'Next' }}</button>
        </div>
      </div>
    </div>
  </ng-container>
  `,
})
export class TourComponent implements OnInit, OnDestroy {
  steps: Step[] = [
    { selector: '#menuButton', title: 'Menu', body: 'Open the menu to access Dashboard, Settings, Help & Tutorial, theme toggle and more.'},
    { selector: '#tour-first-room-details', title: 'Room details', body: 'Click View details on any card to open the modal with amenities, rating, and booking form.'},
  { selector: '.chat-fab', title: 'Chat with Drac', body: 'Click here to open Drac. Use quick actions or ask availability like “Available rooms today”.', centerCard: true},
    { selector: '#main-content', title: 'Settings', body: 'From the menu → Settings: set company address, theme, and chat options.'},
  ];
  index = 0;
  active = false;
  step: Step | null = null;
  holeStyle: any = {};
  cardStyle: any = {};
  resizeHandler?: any;

  ngOnInit(): void {
    const onStart = () => this.start();
    window.addEventListener('app:tour-start', onStart as any);
    (window as any)._tourStartHandler = onStart;
    // Allow ESC to exit
    const onKey = (e: KeyboardEvent) => { if (this.active && e.key === 'Escape') this.skip(); };
    window.addEventListener('keydown', onKey);
    (window as any)._tourKeyHandler = onKey;
  }
  ngOnDestroy(): void {
    const h = (window as any)._tourStartHandler; if (h) window.removeEventListener('app:tour-start', h);
    window.removeEventListener('resize', this.resizeHandler as any);
    window.removeEventListener('scroll', this.resizeHandler as any, true);
    const hk = (window as any)._tourKeyHandler; if (hk) window.removeEventListener('keydown', hk);
  }

  start() {
    document.body.classList.add('tour-open');
    // Ensure Help/Tutorial offcanvas is closed so elements (like chat FAB) are visible
    try {
      const help = document.getElementById('helpCanvas');
      const bootstrapAny = (window as any).bootstrap;
      if (help && bootstrapAny?.Offcanvas) {
        const off = bootstrapAny.Offcanvas.getOrCreateInstance(help);
        off.hide();
      }
      document.body.classList.remove('offcanvas-help-open');
    } catch {}
    this.active = true; this.index = 0; this.applyStep();
    this.resizeHandler = () => this.applyStep();
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('scroll', this.resizeHandler, true);
  }
  stop() {
    document.body.classList.remove('tour-open');
    this.active = false; this.step = null;
    window.removeEventListener('resize', this.resizeHandler as any);
    window.removeEventListener('scroll', this.resizeHandler as any, true);
  }
  skip() { this.stop(); }
  next() { if (this.index < this.steps.length-1) { this.index++; this.applyStep(); } else { this.stop(); } }
  prev() { if (this.index>0) { this.index--; this.applyStep(); } }

  applyStep() {
    this.step = this.steps[this.index];
    const el = document.querySelector(this.step.selector) as HTMLElement | null;
  const rect = el?.getBoundingClientRect();
    const pad = 8;
    // Use viewport coordinates for position: fixed elements (do NOT add scroll offsets)
  const rectValid = !!rect && rect.width > 0 && rect.height > 0;
  // Fallback for missing/hidden targets (e.g., chat FAB hidden by offcanvas)
  const fallbackTop = Math.max(12, window.innerHeight - 20 - 48 - pad*2); // near bottom
  const fallbackLeft = Math.max(12, window.innerWidth - 20 - 80 - pad*2); // near right
  const top = rectValid ? Math.max(8, (rect as DOMRect).top - pad) : fallbackTop;
  const left = rectValid ? Math.max(8, (rect as DOMRect).left - pad) : fallbackLeft;
  const width = rectValid ? (rect as DOMRect).width + pad*2 : 80 + pad*2;
  const height = rectValid ? (rect as DOMRect).height + pad*2 : 48 + pad*2;
    this.holeStyle = { top: top+'px', left: left+'px', width: width+'px', height: height+'px' };

    // Position card: center for specific steps, otherwise below if space else above
    const cardW = 320, cardH = 160;
    let cTop = 0, cLeft = 0;
    if (this.step.centerCard) {
      cTop = Math.max(12, Math.round((window.innerHeight - cardH) / 2));
      cLeft = Math.max(12, Math.round((window.innerWidth - cardW) / 2));
    } else {
      cTop = top + height + 12; cLeft = Math.max(12, left);
      if (cTop + cardH > window.innerHeight) cTop = top - cardH - 12;
      if (cLeft + cardW > window.innerWidth) cLeft = window.innerWidth - cardW - 12;
    }
    this.cardStyle = { top: cTop+'px', left: cLeft+'px' };

    // After render, measure actual card size and clamp fully within viewport
    setTimeout(() => {
      const card = document.querySelector('.tour-card') as HTMLElement | null;
      if (!card) return;
      const w = card.offsetWidth || cardW;
      const h = card.offsetHeight || cardH;
      let cTop2 = this.step?.centerCard ? Math.round((window.innerHeight - h) / 2) : cTop;
      let cLeft2 = this.step?.centerCard ? Math.round((window.innerWidth - w) / 2) : cLeft;
      // If still overlapping bottom, clamp to bottom padding; if overlapping top, clamp to top
      if (cTop2 + h > window.innerHeight - 12) cTop2 = Math.max(12, window.innerHeight - h - 12);
      if (cTop2 < 12) cTop2 = 12;
      if (cLeft2 + w > window.innerWidth - 12) cLeft2 = Math.max(12, window.innerWidth - w - 12);
      if (cLeft2 < 12) cLeft2 = 12;
      this.cardStyle = { top: cTop2+'px', left: cLeft2+'px' };
    }, 0);
  }
}
