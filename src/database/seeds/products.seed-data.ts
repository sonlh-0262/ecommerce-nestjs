import { SeedProduct } from './interfaces/seed-product.interface';
import {
  SEED_FEATURED_SLOT,
  SEED_IMAGE_FILES,
  SEED_PRICE_MIN,
  SEED_PRICE_ROUNDING,
  SEED_PRICE_STEP,
  SEED_PRICE_STEPS,
  SEED_PUBLISH_CYCLE,
  SEED_SALE_EVERY,
  SEED_SALE_RATIO,
  SEED_SCRAMBLE,
  SEED_SOLD_OUT_EVERY,
  SEED_STOCK_MIN,
  SEED_STOCK_SPREAD,
} from './seed.constants';

const product = (
  category: string,
  name: string,
  description: string,
): SeedProduct => ({ name, category, description });

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  product(
    'Áo nam',
    'Áo thun nam cotton basic',
    'Vải cotton 100%, form regular, thấm hút mồ hôi.',
  ),
  product(
    'Áo nam',
    'Áo sơ mi nam công sở',
    'Chất liệu kate lụa, ít nhăn, phù hợp đi làm.',
  ),
  product(
    'Áo nam',
    'Áo khoác gió nam chống nước',
    'Lớp ngoài chống nước nhẹ, có mũ trùm.',
  ),
  product(
    'Quần nam',
    'Quần jean nam ống đứng',
    'Denim co giãn nhẹ, màu xanh đậm.',
  ),
  product(
    'Quần nam',
    'Quần kaki nam slim fit',
    'Kaki mềm, dáng ôm vừa, nhiều màu.',
  ),
  product(
    'Giày nam',
    'Giày thể thao nam đế êm',
    'Đế cao su êm, thoáng khí khi chạy bộ.',
  ),
  product(
    'Giày nam',
    'Giày tây nam da bò',
    'Da bò thật, đế cao su chống trượt.',
  ),
  product('Váy đầm', 'Đầm maxi hoa nhí', 'Vải voan mềm, dáng dài đi biển.'),
  product(
    'Váy đầm',
    'Váy công sở chữ A',
    'Dáng chữ A thanh lịch, vải tuyết mưa.',
  ),
  product('Áo nữ', 'Áo thun nữ cổ tròn', 'Cotton co giãn, nhiều màu pastel.'),
  product('Áo nữ', 'Áo len nữ dệt kim', 'Len mỏng mặc thu đông, giữ ấm tốt.'),
  product('Túi xách', 'Túi xách nữ da PU', 'Da PU mềm, ngăn chứa rộng.'),
  product('Túi xách', 'Ví cầm tay mini', 'Nhỏ gọn, khóa kim loại chắc chắn.'),
  product(
    'Điện thoại di động',
    'Điện thoại thông minh 128GB',
    'Màn hình 6,5 inch, pin 5000 mAh.',
  ),
  product(
    'Điện thoại di động',
    'Điện thoại phổ thông 4G',
    'Pin dùng nhiều ngày, nghe gọi rõ.',
  ),
  product(
    'Điện thoại di động',
    'Ốp lưng điện thoại chống sốc',
    'Silicon dẻo, bảo vệ bốn góc.',
  ),
  product(
    'Máy tính bảng',
    'Máy tính bảng 10 inch',
    'Màn hình lớn, phù hợp học trực tuyến.',
  ),
  product(
    'Máy tính bảng',
    'Bút cảm ứng cho máy tính bảng',
    'Đầu bút mảnh, độ trễ thấp.',
  ),
  product(
    'Laptop',
    'Laptop văn phòng 14 inch',
    'Mỏng nhẹ, SSD 512GB, RAM 16GB.',
  ),
  product(
    'Laptop',
    'Laptop gaming 15,6 inch',
    'Card đồ họa rời, tản nhiệt kép.',
  ),
  product('Màn hình', 'Màn hình 27 inch 2K', 'Tấm nền IPS, tần số quét 75Hz.'),
  product(
    'Màn hình',
    'Màn hình cong 32 inch',
    'Độ cong 1500R, phù hợp chơi game.',
  ),
  product(
    'Phụ kiện máy tính',
    'Bàn phím cơ không dây',
    'Switch đỏ, kết nối Bluetooth và 2.4G.',
  ),
  product(
    'Phụ kiện máy tính',
    'Chuột không dây im lặng',
    'Nút bấm êm, pin dùng 12 tháng.',
  ),
  product(
    'Phụ kiện máy tính',
    'Giá đỡ laptop nhôm',
    'Nhôm nguyên khối, gập gọn.',
  ),
  product(
    'Tai nghe',
    'Tai nghe chống ồn chụp tai',
    'Chống ồn chủ động, pin 30 giờ.',
  ),
  product(
    'Tai nghe',
    'Tai nghe nhét tai không dây',
    'Kết nối nhanh, hộp sạc nhỏ gọn.',
  ),
  product(
    'Loa',
    'Loa Bluetooth chống nước',
    'Chuẩn chống nước IPX7, âm bass mạnh.',
  ),
  product('Loa', 'Loa vi tính 2.1', 'Kèm loa trầm, điều chỉnh âm lượng rời.'),
  product(
    'Đồng hồ thông minh',
    'Đồng hồ thông minh đo nhịp tim',
    'Theo dõi giấc ngủ, nhịp tim, SpO2.',
  ),
  product(
    'Đồng hồ thông minh',
    'Vòng đeo tay sức khỏe',
    'Đếm bước chân, nhắc vận động.',
  ),
  product(
    'Đồ dùng nhà bếp',
    'Nồi chiên không dầu 5 lít',
    'Dung tích lớn, nhiều chế độ nấu.',
  ),
  product(
    'Đồ dùng nhà bếp',
    'Bộ dao inox 5 món',
    'Inox không gỉ, kèm giá cắm dao.',
  ),
  product(
    'Đồ dùng nhà bếp',
    'Chảo chống dính đáy từ',
    'Dùng được bếp từ, lớp chống dính bền.',
  ),
  product(
    'Đồ trang trí',
    'Đèn ngủ gỗ để bàn',
    'Ánh sáng vàng ấm, chân gỗ tự nhiên.',
  ),
  product(
    'Đồ trang trí',
    'Tranh canvas phong cảnh',
    'In canvas sắc nét, khung gỗ thông.',
  ),
  product(
    'Đồ trang trí',
    'Chậu cây mini để bàn',
    'Gốm sứ men trắng, kèm cây sen đá.',
  ),
  product(
    'Chăm sóc da',
    'Sữa rửa mặt dịu nhẹ',
    'Không chứa xà phòng, hợp da nhạy cảm.',
  ),
  product(
    'Chăm sóc da',
    'Kem chống nắng SPF50',
    'Kết cấu mỏng nhẹ, không bết dính.',
  ),
  product('Chăm sóc da', 'Serum dưỡng ẩm', 'Cấp ẩm sâu, thẩm thấu nhanh.'),
  product('Trang điểm', 'Son kem lì', 'Lên màu chuẩn, giữ màu lâu.'),
  product(
    'Trang điểm',
    'Phấn phủ kiềm dầu',
    'Hạt phấn mịn, kiềm dầu suốt ngày.',
  ),
  product(
    'Dụng cụ thể thao',
    'Thảm tập yoga 6mm',
    'Cao su non chống trượt, dày 6mm.',
  ),
  product(
    'Dụng cụ thể thao',
    'Bộ tạ tay điều chỉnh',
    'Điều chỉnh từ 2 đến 10 kg.',
  ),
  product(
    'Dụng cụ thể thao',
    'Dây nhảy thể lực',
    'Cán chống trượt, dây cáp bọc nhựa.',
  ),
  product('Balo du lịch', 'Balo du lịch 40 lít', 'Nhiều ngăn, chống nước nhẹ.'),
  product(
    'Balo du lịch',
    'Balo laptop chống sốc',
    'Ngăn laptop 15,6 inch có đệm.',
  ),
  product('Đồ cắm trại', 'Lều cắm trại 4 người', 'Dựng nhanh, chống mưa nhẹ.'),
  product(
    'Đồ cắm trại',
    'Đèn pin sạc cắm trại',
    'Pin sạc USB, ba chế độ sáng.',
  ),
  product(
    'Đồ cắm trại',
    'Bình giữ nhiệt 1 lít',
    'Inox 304, giữ nóng lạnh 12 giờ.',
  ),
];

export interface SeedProductAttributes {
  price: number;
  salePrice: number | null;
  stock: number;
  published: boolean;
  isFeatured: boolean;
  imageCount: number;
}

export function seedProductAttributes(index: number): SeedProductAttributes {
  const scrambled = index * SEED_SCRAMBLE;
  const price =
    SEED_PRICE_MIN + (scrambled % SEED_PRICE_STEPS) * SEED_PRICE_STEP;
  const cycle = index % SEED_PUBLISH_CYCLE;

  return {
    price,
    salePrice:
      index % SEED_SALE_EVERY === 0
        ? Math.round((price * SEED_SALE_RATIO) / SEED_PRICE_ROUNDING) *
          SEED_PRICE_ROUNDING
        : null,
    stock:
      index % SEED_SOLD_OUT_EVERY === 0
        ? 0
        : SEED_STOCK_MIN + (scrambled % SEED_STOCK_SPREAD),
    published: cycle !== 0,
    isFeatured: cycle === SEED_FEATURED_SLOT,
    imageCount: 1 + (index % SEED_IMAGE_FILES.length),
  };
}
