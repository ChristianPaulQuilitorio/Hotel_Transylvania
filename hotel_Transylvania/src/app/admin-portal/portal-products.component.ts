import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { supabaseAdmin } from '../services/supabase.service';
import { firstValueFrom, Observable, of } from 'rxjs';
import { Inject } from '@angular/core';

@Component({
  selector: 'app-portal-products',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatToolbarModule, MatIconModule, MatProgressSpinnerModule, MatDialogModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSnackBarModule],
  styles: [
    `:host { display:block }
     mat-card.admin-card { background: #fbf7ef; color:#111; padding:0; border-radius:8px; }
     mat-card.admin-card .mat-toolbar { background:#2b2b2b; color:#fff; }
     .text-muted { color: rgba(0,0,0,0.6); }
     table.mat-table { width:100%; }
     .stack-view { display:none }
     @media (max-width:768px) {
       .table-view { display:none }
       .stack-view { display:block; padding:12px }
       .product-card { margin:8px 0; padding:12px; border-radius:8px }
     }
    `
  ],
  template: `
    <mat-card class="admin-card">
      <mat-toolbar color="primary">
        <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <span style="margin-left:12px; font-weight:600;">Products (Admin Portal)</span>
      </mat-toolbar>

      <div class="content" style="padding:16px">
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <button mat-flat-button color="primary" (click)="createProduct()">Create product</button>
          <button mat-stroked-button (click)="refresh()">Refresh</button>
        </div>

        <ng-container *ngIf="products$ | async as products; else loading">
          <div *ngIf="!products || products.length === 0" class="text-muted">No products found.</div>

          <div *ngIf="products && products.length">
            <div class="stack-view">
              <mat-card class="product-card" *ngFor="let p of products">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-weight:600">{{p.name}}</div>
                    <div class="text-muted">SKU: {{p.sku || '-'}}</div>
                    <div class="text-muted">Price: {{p.price | currency:'PHP':'symbol':'1.2-2'}}</div>
                  </div>
                  <div>
                    <button mat-icon-button (click)="editProduct(p)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button (click)="deleteProduct(p)"><mat-icon>delete</mat-icon></button>
                  </div>
                </div>
              </mat-card>
            </div>

            <div class="table-view">
              <table mat-table [dataSource]="products" class="mat-elevation-z1">

                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef> Name </th>
                  <td mat-cell *matCellDef="let p">{{p.name}}</td>
                </ng-container>

                <ng-container matColumnDef="sku">
                  <th mat-header-cell *matHeaderCellDef> SKU </th>
                  <td mat-cell *matCellDef="let p">{{p.sku || '-'}}</td>
                </ng-container>

                <ng-container matColumnDef="price">
                  <th mat-header-cell *matHeaderCellDef> Price </th>
                  <td mat-cell *matCellDef="let p">{{p.price | currency:'PHP':'symbol':'1.2-2'}}</td>
                </ng-container>

                <ng-container matColumnDef="stock">
                  <th mat-header-cell *matHeaderCellDef> Stock </th>
                  <td mat-cell *matCellDef="let p">{{p.stock || 0}}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef> Actions </th>
                  <td mat-cell *matCellDef="let p">
                    <button mat-icon-button aria-label="Edit" (click)="editProduct(p)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button aria-label="Delete" (click)="deleteProduct(p)"><mat-icon>delete</mat-icon></button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>
            </div>
          </div>
        </ng-container>

        <ng-template #loading>
          <div style="padding:16px; display:flex; align-items:center; gap:12px;">
            <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
            <div class="text-muted">Loading products…</div>
          </div>
        </ng-template>
      </div>
    </mat-card>
  `
})
export class PortalProductsComponent implements OnInit {
  products$: Observable<any[] | null> = of(null);
  displayedColumns = ['name','sku','price','stock','actions'];
  constructor(private _dialog: MatDialog, private _snack: MatSnackBar) {}

  ngOnInit(): void {
    this.loadProducts().catch(e => console.warn('load products failed', e));
  }

  back() { window.setTimeout(() => history.back(), 0); }

  async loadProducts() {
    try {
      const { data, error } = await supabaseAdmin.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      this.products$ = of(data || []);
    } catch (e: any) {
      console.warn('loadProducts', e);
      this._snack.open('Failed to load products: ' + (e.message || e), 'Close', { duration: 4000 });
      this.products$ = of([]);
    }
  }

  async refresh() { await this.loadProducts(); }

  private _openDialog(product: any) {
    return this._dialog.open(ProductDialogComponent, { width: '420px', data: { product } });
  }

  async createProduct() {
    const ref = this._openDialog(null);
    const res: any = await firstValueFrom(ref.afterClosed());
    if (!res) return;
    try {
      const payload = { name: res.name, sku: res.sku || null, price: res.price || 0, stock: res.stock || 0 };
      const { data, error } = await supabaseAdmin.from('products').insert(payload).select();
      if (error) throw error;
      this._snack.open('Product created', 'Close', { duration: 3000 });
      await this.loadProducts();
    } catch (e: any) {
      console.warn('createProduct failed', e);
      this._snack.open('Create failed: ' + (e.message || e), 'Close', { duration: 4000 });
    }
  }

  async editProduct(product: any) {
    const ref = this._openDialog(product);
    const res: any = await firstValueFrom(ref.afterClosed());
    if (!res) return;
    try {
      const { data, error } = await supabaseAdmin.from('products').update({ name: res.name, sku: res.sku || null, price: res.price || 0, stock: res.stock || 0 }).eq('id', product.id).select();
      if (error) throw error;
      this._snack.open('Product updated', 'Close', { duration: 3000 });
      await this.loadProducts();
    } catch (e: any) {
      console.warn('update product failed', e);
      this._snack.open('Update failed: ' + (e.message || e), 'Close', { duration: 4000 });
    }
  }

  async deleteProduct(product: any) {
    const ok = confirm('Delete product "' + (product.name || product.id) + '"?');
    if (!ok) return;
    try {
      const { data, error } = await supabaseAdmin.from('products').delete().eq('id', product.id).select();
      if (error) throw error;
      this._snack.open('Product deleted', 'Close', { duration: 3000 });
      await this.loadProducts();
    } catch (e: any) {
      console.warn('delete product failed', e);
      this._snack.open('Delete failed: ' + (e.message || e), 'Close', { duration: 4000 });
    }
  }
}

@Component({
  selector: 'app-product-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-title>{{ data?.product ? 'Edit product' : 'Create product' }}</mat-card-title>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="save()">
          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>SKU</mat-label>
            <input matInput formControlName="sku" />
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Price</mat-label>
            <input matInput type="number" formControlName="price" />
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Stock</mat-label>
            <input matInput type="number" formControlName="stock" />
          </mat-form-field>

          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button mat-button type="button" (click)="close()">Cancel</button>
            <button mat-raised-button color="primary" type="submit">Save</button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `
})
export class ProductDialogComponent {
  form: FormGroup;
  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<ProductDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    const p = data?.product || {};
    this.form = this.fb.group({ name: [p.name || '', Validators.required], sku: [p.sku || ''], price: [p.price ?? 0], stock: [p.stock ?? 0] });
  }
  save() { if (this.form.valid) this.dialogRef.close(this.form.value); }
  close() { this.dialogRef.close(null); }
}
