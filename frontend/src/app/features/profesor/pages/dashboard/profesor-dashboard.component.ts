import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'app-profesor-dashboard',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './profesor-dashboard.component.html',
  styleUrl: './profesor-dashboard.component.scss',
})
export class ProfesorDashboardComponent {}
