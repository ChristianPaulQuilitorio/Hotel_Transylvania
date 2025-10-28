import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { signUp, supabase } from '../services/supabase.service';

declare const bootstrap: any;

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Signup modal -->
    <div #signupModal class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create account</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <form (ngSubmit)="onSubmit()">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Username</label>
                <input class="form-control" [(ngModel)]="username" name="username" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input class="form-control" [(ngModel)]="email" name="email" type="email" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Password</label>
                <input class="form-control" [(ngModel)]="password" name="password" type="password" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Confirm Password</label>
                <input class="form-control" [(ngModel)]="confirmPassword" name="confirmPassword" type="password" required />
              </div>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" [(ngModel)]="agree" name="agree" id="agree" required />
                <label class="form-check-label" for="agree">
                  I agree to the
                  <a href="#" role="button" data-bs-toggle="modal" data-bs-target="#legalModal">Privacy Policy</a>
                  and
                  <a href="#" role="button" data-bs-toggle="modal" data-bs-target="#legalModal">Terms</a>.
                </label>
              </div>
              <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" type="submit" [disabled]="!agree || !email || !username || !password || (password !== confirmPassword)">Create account</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Success Toast -->
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1080">
      <div #signupToast class="toast align-items-center text-white bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">
            Account created successfully. Please verify your email via Gmail.
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    </div>
  `
})
export class SignupComponent implements AfterViewInit, OnDestroy {
  @ViewChild('signupModal', { static: true }) signupModalRef!: ElementRef<HTMLDivElement>;
  @ViewChild('signupToast', { static: true }) signupToastRef!: ElementRef<HTMLDivElement>;

  private bsModal: any;
  private closedViaSuccess = false;
  private hiddenHandler?: () => void;

  email = '';
  password = '';
  username = '';
  confirmPassword = '';
  agree = false;
  error: string | null = null;

  constructor(private router: Router) {}

  open() {
    const el = this.signupModalRef.nativeElement;
    this.bsModal = new (window as any).bootstrap.Modal(el);
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

    if (!this.agree) {
      this.error = 'You must agree to the Privacy Policy and Terms.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    const { data, error } = await signUp(this.email, this.password);
    if (error) {
      this.error = error.message ?? 'Signup failed';
      return;
    }

    // if supabase returned a user id, create profile row
    const userId = (data as any)?.user?.id;
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .upsert({ id: userId, username: this.username, email: this.email }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (e) {
        // ignore profile errors for now (RLS or network). Upsert reduces 409 conflicts.
        console.warn('profile upsert failed', e);
      }
    }

    // close modal and show success toast; keep user on landing to verify email
    this.closedViaSuccess = true;
    this.close();
    setTimeout(() => this.showSuccessToast(), 200);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.open());
  }

  ngOnDestroy(): void {
    try {
      const el = this.signupModalRef?.nativeElement;
      if (el && this.hiddenHandler) {
        el.removeEventListener('hidden.bs.modal', this.hiddenHandler);
      }
    } catch {}
  }

  private showSuccessToast() {
    try {
      const el = this.signupToastRef?.nativeElement;
      if (!el) return;
      const toast = new (window as any).bootstrap.Toast(el, { delay: 4000 });
      toast.show();
    } catch {
      // no-op if bootstrap toast unavailable
    }
  }
}
