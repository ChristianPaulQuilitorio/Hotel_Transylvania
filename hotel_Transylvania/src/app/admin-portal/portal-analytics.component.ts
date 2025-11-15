import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { AdminService } from '../admin/admin.service';
import { Observable } from 'rxjs';
import Chart from 'chart.js/auto';
import { ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-portal-analytics',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatToolbarModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSelectModule, MatTableModule],
  template: `
    <mat-card class="admin-card">
      <mat-toolbar color="primary">
        <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <span style="margin-left:12px; font-weight:600;">Analytics (Admin Portal)</span>
        <span style="flex:1 1 auto"></span>
        <button mat-icon-button aria-label="refresh" (click)="refresh()"><mat-icon>refresh</mat-icon></button>
      </mat-toolbar>

      <div style="padding:16px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <mat-card style="flex:1 1 180px;min-width:160px;padding:12px">
            <div style="font-size:12px;color:rgba(0,0,0,0.6)">Total Rooms</div>
            <div style="font-size:20px;font-weight:700">{{ (summary?.totalRooms ?? '-') }}</div>
          </mat-card>
          <mat-card style="flex:1 1 180px;min-width:160px;padding:12px">
            <div style="font-size:12px;color:rgba(0,0,0,0.6)">Bookings ({{days}}d)</div>
            <div style="font-size:20px;font-weight:700">{{ (summary?.totalBookings ?? '-') }}</div>
          </mat-card>
          <mat-card style="flex:1 1 180px;min-width:160px;padding:12px">
            <div style="font-size:12px;color:rgba(0,0,0,0.6)">Revenue ({{days}}d)</div>
            <div style="font-size:20px;font-weight:700">{{ (summary?.revenue ? (summary.revenue | currency:'PHP') : '-') }}</div>
          </mat-card>
          <mat-card style="flex:1 1 180px;min-width:160px;padding:12px">
            <div style="font-size:12px;color:rgba(0,0,0,0.6)">Cancellation %</div>
            <div style="font-size:20px;font-weight:700">{{ cancellationPercent }}%</div>
          </mat-card>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;gap:6px;align-items:center">
            <button mat-stroked-button (click)="setDays(7)" [disabled]="days===7">7d</button>
            <button mat-stroked-button (click)="setDays(30)" [disabled]="days===30">30d</button>
            <button mat-stroked-button (click)="setDays(90)" [disabled]="days===90">90d</button>
          </div>
          <div style="flex:1 1 auto"></div>
          <mat-select placeholder="Room" [(value)]="roomFilter" style="min-width:180px">
            <mat-option [value]="null">All rooms</mat-option>
            <mat-option *ngFor="let r of roomsList" [value]="r.id">{{r.name}}</mat-option>
          </mat-select>
        </div>

        <div style="display:flex;gap:12px;flex-direction:column">
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <mat-card style="flex:2 1 480px;padding:12px;min-width:280px">
              <div style="font-weight:600;margin-bottom:8px">Bookings per day</div>
              <div *ngIf="loadingDaily" style="display:flex;align-items:center;gap:8px"><mat-progress-spinner diameter="20" mode="indeterminate"></mat-progress-spinner> Loading…</div>
              <div>
                <div style="position:relative;width:100%;height:220px"> 
                  <canvas #dailyChart style="width:100%;height:100%"></canvas>
                  <div *ngIf="loadingDaily" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.6)">
                    <mat-progress-spinner diameter="32" mode="indeterminate"></mat-progress-spinner>
                  </div>
                </div>
                <table mat-table [dataSource]="dailyData" class="mat-elevation-z1" style="width:100%;margin-top:8px">
                  <ng-container matColumnDef="day"><th mat-header-cell *matHeaderCellDef>Day</th><td mat-cell *matCellDef="let d">{{d.day}}</td></ng-container>
                  <ng-container matColumnDef="bookings"><th mat-header-cell *matHeaderCellDef>Bookings</th><td mat-cell *matCellDef="let d">{{d.bookings}}</td></ng-container>
                  <tr mat-header-row *matHeaderRowDef="['day','bookings']"></tr>
                  <tr mat-row *matRowDef="let row; columns: ['day','bookings'];"></tr>
                </table>
              </div>
            </mat-card>

            <mat-card style="flex:1 1 220px;padding:12px;min-width:220px">
              <div style="font-weight:600;margin-bottom:8px">Top rooms (by bookings)</div>
              <div *ngIf="topRooms && topRooms.length; else noTop"> 
                <div *ngFor="let t of topRooms | slice:0:5" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04)">
                  <div>{{t.name}}</div>
                  <div style="text-align:right">
                    <div class="text-muted">{{t.count}}</div>
                    <div style="font-size:12px;color:rgba(0,0,0,0.6)">{{t.revenue ? (t.revenue | currency:'PHP') : '-'}}</div>
                  </div>
                </div>
              </div>
              <ng-template #noTop><div class="text-muted">No data</div></ng-template>
            </mat-card>
          </div>
        </div>
      </div>
    </mat-card>
  `,
  styles: [
    `:host { display:block }
     mat-card.admin-card { background: #fbf7ef; }
     .text-muted { color: rgba(0,0,0,0.6) }
    `
  ]
})
export class PortalAnalyticsComponent implements OnInit {
  days = 30;
  roomFilter: any = null;
  loadingSummary = false;
  loadingDaily = false;
  summary: any = null;
  dailyData: any[] = [];
  topRooms: any[] = [];
  roomsList: any[] = [];
  chartWidth = 600;
  chartHeight = 120;
  sparklinePath = '';
  @ViewChild('dailyChart', { static: true }) dailyChart?: ElementRef<HTMLCanvasElement>;
  private chartInstance: any = null;
  constructor(private svc: AdminService) {}

  async ngOnInit(): Promise<void> {
    // Prefetch rooms so room filter shows immediately
    this.svc.getRooms().catch(() => {});
    this.svc.rooms$.subscribe(r => { this.roomsList = r || []; });
    this.svc.topRooms$.subscribe(tr => { this.topRooms = tr || []; });

    // Initialize the chart early so loadDaily can update it on first load
    this.initChart();
    await Promise.all([this.loadSummary(), this.loadDaily(), this.svc.getTopRooms().catch(() => {})]);
  }

  private initChart() {
    try {
      const ctx = this.dailyChart && this.dailyChart.nativeElement.getContext('2d');
      if (!ctx) return;
      this.chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Bookings', data: [], borderColor: '#1976d2', backgroundColor: 'rgba(25,118,210,0.08)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { beginAtZero: true } } }
      });
      console.debug('PortalAnalytics: chart initialized', this.chartInstance);
    } catch (e) { console.warn('initChart failed', e); }
  }

  back() { history.back(); }

  async setDays(n: number) { this.days = n; await this.loadDaily(); await this.loadSummary(); }

  async refresh() {
    this.loadingSummary = true; this.loadingDaily = true;
    await this.svc.refreshAnalytics().catch(() => {});
    await this.svc.refreshTopRooms().catch(() => {});
    await Promise.all([this.loadSummary(), this.loadDaily(), this.svc.getTopRooms().catch(() => {})]);
  }

  private async loadSummary() {
    try {
      this.loadingSummary = true;
      const s = await this.svc.getAnalyticsSummary(this.days);
      this.summary = s || {};
      // Load top rooms via AdminService RPC/fallback
      try {
        const tr = await this.svc.getTopRooms(this.days, 10);
        this.topRooms = tr || [];
      } catch (e) {
        // keep existing subject subscription as a fallback
      }
    } finally { this.loadingSummary = false; }
  }

  private async loadDaily() {
    try {
      this.loadingDaily = true;
      const d = await this.svc.getDailyBookings(this.days, this.roomFilter);
      this.dailyData = d || [];
      const values = this.dailyData.map((x:any) => Number(x.bookings || 0));
      this.sparklinePath = this.buildSparkline(values);
      // update chart data
      try {
        if (this.chartInstance) {
          this.chartInstance.data.labels = (this.dailyData || []).map((x: any) => x.day);
          this.chartInstance.data.datasets[0].data = values;
          // Defer update to ensure the canvas has been measured by the browser
          setTimeout(() => {
            try { this.chartInstance.update();
              console.debug('PortalAnalytics: chart updated', { labels: this.chartInstance.data.labels, data: this.chartInstance.data.datasets[0].data });
            } catch (e) { console.warn('chart update failed', e); }
          }, 0);
        }
      } catch (_) {}
    } finally { this.loadingDaily = false; }
  }

  private buildSparkline(values: number[]): string {
    if (!values || !values.length) return '';
    const w = Math.max(120, Math.min(this.chartWidth, values.length * 6));
    const h = this.chartHeight;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = (max - min) || 1;
    const step = w / Math.max(1, values.length - 1);
    const points = values.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    });
    return 'M' + points.join(' L ');
  }

  get cancellationPercent(): string {
    try {
      const v = this.summary?.cancellationRate;
      if (!v && v !== 0) return '0';
      return (Number(v) * 100).toFixed(1);
    } catch { return '0'; }
  }
}

