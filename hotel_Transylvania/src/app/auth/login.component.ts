import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { signIn } from '../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Bootstrap modal for login -->
    <div #loginModal class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Login</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <form (ngSubmit)="onSubmit()">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input class="form-control" [(ngModel)]="email" name="email" type="email" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Password</label>
                <input class="form-control" [(ngModel)]="password" name="password" type="password" required />
              </div>
              <div *ngIf="successMessage" class="alert alert-success">{{ successMessage }}</div>
              <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
            </div>
            <div class="modal-footer">
              <button type="submit" class="btn btn-primary">Login</button>
              <button type="button" class="btn btn-link" (click)="openSignup()">Sign up</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  email = '';
  password = '';
  error: string | null = null;
  successMessage: string | null = null;

  @ViewChild('loginModal', { static: true }) loginModalRef!: ElementRef<HTMLDivElement>;

  private bsModal: any;
  private closedViaSuccess = false;
  private hiddenHandler?: () => void;

  constructor(private router: Router, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}

  open() {
    // ensure modal instance
    const el = this.loginModalRef.nativeElement;
    this.bsModal = new (window as any).bootstrap.Modal(el);
    // navigate back when user closes modal manually
    const onHidden = () => {
      if (!this.closedViaSuccess) {
        this.router.navigate(['/']);
      }
    };
    this.hiddenHandler = onHidden;
    el.addEventListener('hidden.bs.modal', onHidden);
    this.bsModal.show();
  }

  close() {
    this.bsModal?.hide();
  }

  async onSubmit() {
    this.error = null;
    const { data, error } = await signIn(this.email, this.password);
    if (error) {
      this.error = error.message ?? 'Login failed';
      return;
    }
    // navigate to dashboard on success and close modal
    this.closedViaSuccess = true;
    this.close();
    this.router.navigate(['/dashboard']);
  }

  openSignup() {
    // delegate to router to go to signup route modal (AppComponent will open modal if needed)
    this.close();
    this.router.navigate(['/signup']);
  }

  ngAfterViewInit(): void {
    // Show success message when redirected after signup, then auto-open modal
    const signup = this.route.snapshot.queryParamMap.get('signup');
    if (signup) {
      this.successMessage = 'Account created successfully. Please verify your email before signing in.';
      // Clear any existing chat history for first-time signups so Drac starts fresh
      try { localStorage.removeItem('chat_history'); } catch {}
    }
    // Auto-open when navigated to via route
    setTimeout(() => {
      this.open();
      // ensure OnPush notices the successMessage
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    try {
      const el = this.loginModalRef?.nativeElement;
      if (el && this.hiddenHandler) {
        el.removeEventListener('hidden.bs.modal', this.hiddenHandler);
      }
    } catch {}
  }
}
