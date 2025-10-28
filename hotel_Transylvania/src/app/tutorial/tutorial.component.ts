import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-tutorial',
  imports: [CommonModule],
  template: `
  <div class="offcanvas offcanvas-end" tabindex="-1" id="helpCanvas" aria-labelledby="helpTitle" style="width:380px">
    <div class="offcanvas-header">
      <h5 class="offcanvas-title" id="helpTitle">Welcome to BookSmart</h5>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body">
      <p class="text-muted">A quick guide to help you get started.</p>

      <ol class="small pe-1">
        <li class="mb-2">
          <strong>Sign up or Log in</strong><br>
          Use the menu (top-left) → Login / Sign up. We use Supabase for secure authentication.
        </li>
        <li class="mb-2">
          <strong>Explore the Dashboard</strong><br>
          Rooms are displayed as cards. The green <em>Available</em> badge means a room can be booked. Click <em>View details</em> for amenities, ratings, and the booking modal.
        </li>
        <li class="mb-2">
          <strong>Book a room</strong><br>
          In the details modal: pick a check‑in date and 1–5 days, then click <em>Avail</em>. Booked rooms can only be canceled by the original booker.
        </li>
        <li class="mb-2">
          <strong>Rate and review</strong><br>
          Give 1–5 stars and add an optional comment. Your feedback improves the hotel experience. We show average ratings on cards.
        </li>
        <li class="mb-2">
          <strong>Ask Drac (chatbot)</strong><br>
          Click the Chat button (bottom corner). Try quick actions like <em>Rooms & amenities</em> or ask about availability (e.g., "Is room 2 available tomorrow?").
        </li>
        <li class="mb-2">
          <strong>Settings & personalization</strong><br>
          Menu → Settings: set company address, toggle Dark/Khaki theme, pick chat button side, and enable the "/" keyboard shortcut to focus chat.
        </li>
      </ol>

      <div class="alert alert-info small">
        Tip: You can open this tutorial anytime from Menu → <strong>Help & Tutorial</strong>.
      </div>

      <div class="d-flex justify-content-between align-items-center mt-3">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="helpDontShow" (change)="toggleDontShow($event)">
          <label class="form-check-label" for="helpDontShow">Don’t show this again</label>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary" type="button" (click)="restartTour()">Restart tour</button>
          <button class="btn btn-primary" data-bs-dismiss="offcanvas">Got it</button>
        </div>
      </div>
    </div>
  </div>
  `,
})
export class TutorialComponent {
  toggleDontShow(ev: Event) {
    try {
      const checked = (ev.target as HTMLInputElement)?.checked ?? false;
      if (checked) localStorage.setItem('seen_tutorial', '1');
      else localStorage.removeItem('seen_tutorial');
    } catch {}
  }

  restartTour() {
    try { window.dispatchEvent(new CustomEvent('app:tour-start')); } catch {}
  }
}
