import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, AppSettings } from '../services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container mt-4" aria-labelledby="settingsTitle">
      <h3 id="settingsTitle" class="mb-3">Settings</h3>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h5 class="card-title">Organization</h5>
          <div class="mb-2">
            <label for="companyAddress" class="form-label">Company address</label>
            <input
              id="companyAddress"
              type="text"
              class="form-control"
              placeholder="e.g., 1313 Mockingbird Lane, Transylvania"
              [(ngModel)]="model.companyAddress"
              (input)="onAddressInput()"
            />
            <div class="form-text">This address may appear on receipts or email footers.</div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h5 class="card-title">Appearance</h5>
          <div class="form-check form-switch my-2">
            <input class="form-check-input" type="checkbox" id="hc" [(ngModel)]="model.highContrast" (change)="onChange()">
            <label class="form-check-label" for="hc">Dark mode</label>
          </div>
          <div class="form-check form-switch my-2">
            <input class="form-check-input" type="checkbox" id="grad" [(ngModel)]="model.toolbarGradient" (change)="onChange()">
            <label class="form-check-label" for="grad">Toolbar gradient</label>
          </div>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h5 class="card-title">Chat preferences</h5>
          <div class="form-check form-switch my-2">
            <input class="form-check-input" type="checkbox" id="shortcut" [(ngModel)]="model.enableChatShortcut" (change)="onChange()">
            <label class="form-check-label" for="shortcut">Enable '/' to open chat</label>
          </div>
          <div class="row g-2 align-items-center mt-1">
            <div class="col-auto"><label for="fabSide" class="col-form-label">Chat button position</label></div>
            <div class="col-auto">
              <select id="fabSide" class="form-select" [(ngModel)]="model.chatFabSide" (change)="onChange()">
                <option value="right">Bottom right</option>
                <option value="left">Bottom left</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h5 class="card-title">Motion</h5>
          <div class="row g-2 align-items-center">
            <div class="col-auto"><label for="speed" class="col-form-label">Featured carousel speed</label></div>
            <div class="col-auto">
              <select id="speed" class="form-select" [(ngModel)]="model.scrollerSpeed" (change)="onChange()">
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Recommended</h5>
          <ul class="mb-0">
            <li>Enable High contrast if you prefer stronger text/background separation.</li>
            <li>Keep '/' chat shortcut on for quick help anywhere.</li>
            <li>Use 'Bottom right' chat button for familiarity; switch left if it overlaps other UI.</li>
            <li>Set Featured carousel speed to 'Slow' for comfort, 'Fast' if you like more motion.</li>
          </ul>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  model!: AppSettings;
  private addressDebounce?: any;

  constructor(private settings: SettingsService) {}

  ngOnInit(): void {
    this.model = this.settings.get();
  }

  onChange() {
    this.settings.set(this.model);
  }

  onAddressInput() {
    // Debounce to keep typing responsive and avoid excessive localStorage writes
    if (this.addressDebounce) {
      clearTimeout(this.addressDebounce);
    }
    this.addressDebounce = setTimeout(() => {
      this.settings.set({ companyAddress: this.model.companyAddress });
      this.addressDebounce = undefined;
    }, 300);
  }
}
