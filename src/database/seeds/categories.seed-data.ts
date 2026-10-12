import { SeedCategory } from './interfaces/seed-category.interface';

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  { name: 'Thời trang nam', children: ['Áo nam', 'Quần nam', 'Giày nam'] },
  { name: 'Thời trang nữ', children: ['Váy đầm', 'Áo nữ', 'Túi xách'] },
  { name: 'Điện thoại', children: ['Điện thoại di động', 'Máy tính bảng'] },
  {
    name: 'Máy tính',
    children: ['Laptop', 'Màn hình', 'Phụ kiện máy tính'],
  },
  {
    name: 'Thiết bị âm thanh',
    children: ['Tai nghe', 'Loa', 'Đồng hồ thông minh'],
  },
  { name: 'Nhà cửa', children: ['Đồ dùng nhà bếp', 'Đồ trang trí'] },
  { name: 'Sắc đẹp', children: ['Chăm sóc da', 'Trang điểm'] },
  {
    name: 'Thể thao',
    children: ['Dụng cụ thể thao', 'Balo du lịch', 'Đồ cắm trại'],
  },
];
