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
                <input class="form-check-input" type="checkbox" [(ngModel)]="agree" name="agree" id="agree" />
                <label class="form-check-label" for="agree">I agree to the <a href="#">Privacy Policy</a> and <a href="#">Terms</a>.</label>
              </div>
              <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" type="submit">Create account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class SignupComponent implements AfterViewInit, OnDestroy {
  @ViewChild('signupModal', { static: true }) signupModalRef!: ElementRef<HTMLDivElement>;

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
        await supabase.from('profiles').insert({ id: userId, username: this.username, email: this.email });
      } catch (e) {
        // ignore profile errors for now
        console.warn('profile insert failed', e);
      }
    }

    // close modal and navigate to dashboard
    this.closedViaSuccess = true;
    this.close();
    this.router.navigate(['/dashboard']);
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
}
