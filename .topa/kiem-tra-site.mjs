#!/usr/bin/env node
// kiem-tra-site.mjs — CỔNG CHẤT LƯỢNG cho một kho website tĩnh của khách.
//
// ⚠️ TỆP NÀY KHÔNG CHẠY TRONG APP. Nó là NỘI DUNG mà app cài vào kho của khách
// (`.topa/kiem-tra-site.mjs`), rồi khuôn workflow gọi nó trước khi đăng. Sửa ở
// đây thì phải tăng `PHIEN_BAN` trong `deploy-workflow.js` — nếu không, kho đã
// cài bản cũ sẽ không bao giờ được nâng.
//
// VÌ SAO NÓ QUAY LẠI
// Khuôn deploy v1 chỉ đăng thẳng lên Pages, KHÔNG kiểm gì. Thế hệ workflow
// trước nó có cổng này (`kiem-tra.yml` trong các kho sinh tháng 7–9/2026) và
// lần chạy đầu tiên trên một kho thật đã bắt được **97 liên kết nội bộ hỏng** —
// thư mục `en/` chỉ có `index.html` trong khi nó liên kết tới 5 trang khác.
// Bỏ cổng đi là một bước LÙI: bản sao hỏng đi thẳng ra mạng.
//
// Nguyên bản nằm rải trong từng kho khách, mỗi kho một bản, không ai nâng cấp.
// Nay nó về đây làm MỘT nguồn.
//
// VÌ SAO KHÔNG NHÚNG THẲNG VÀO YAML
// Nhúng 200 dòng JavaScript vào một chuỗi YAML là đúng cái bẫy `${` mà
// `deploy-workflow.js` đã dựng rào — và mỗi lần sửa lại phải escape lại. Tệp
// riêng thì `node --check` của CI soi được, và bộ kiểm chạy thẳng được nó.
//
// Chạy tay:  node .topa/kiem-tra-site.mjs
//
// Không phụ thuộc gói ngoài, không cần cài gì. Thoát 1 khi có lỗi chặn.
//
// VÌ SAO CÓ CỔNG NÀY
// Kho khách sinh ra bằng công cụ clone tự động. Bản sao hỏng KHÔNG tự báo: công
// cụ trả về "87 tệp, 3.2MB, thiếu: 0" trông như thành công hoàn hảo, mở ra là
// trang trắng hoặc ảnh vỡ hàng loạt. Đã dính đúng hai lần:
//
//   • một lần đổi kiểu trả về của hàm tải làm MỌI trang thành chuỗi
//     "[object Object]" — dài đúng 15 ký tự, không test nào bắt được;
//   • một lần thực thể `&amp;` trong URL làm mất 20 ảnh của một trang mẫu.
//
// Cả hai đều lọt vì không ai ĐO bản sao, chỉ nhìn báo cáo của chính công cụ
// sinh ra nó. Tệp này đo bản sao như một người dùng thật sẽ thấy.

import fs from 'node:fs';
import path from 'node:path';

const GOC = process.cwd();
const CFG = doCauHinh();

let loi = 0, canhBao = 0;
const dsLoi = [], dsCanhBao = [];

function bao(dat, ten, chiTiet = '') {
  if (dat) { console.log(`  ✓ ${ten}`); return true; }
  loi++; dsLoi.push(ten + (chiTiet ? ' — ' + chiTiet : ''));
  console.log(`  ✗ ${ten}${chiTiet ? ' — ' + chiTiet : ''}`);
  return false;
}
function nhac(ten, chiTiet = '') {
  canhBao++; dsCanhBao.push(ten + (chiTiet ? ' — ' + chiTiet : ''));
  console.log(`  ⚠ ${ten}${chiTiet ? ' — ' + chiTiet : ''}`);
}
function nhom(t) { console.log(`\n▶ ${t}`); }

function doCauHinh() {
  try { return JSON.parse(fs.readFileSync(path.join(GOC, 'site.config.json'), 'utf8')); }
  catch { return {}; }
}

/** Liệt kê mọi tệp, bỏ .git và thư mục hạ tầng. */
function moiTep(thuMuc = GOC, ra = []) {
  for (const m of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    if (m.name === '.git' || m.name === 'node_modules') continue;
    const p = path.join(thuMuc, m.name);
    if (m.isDirectory()) moiTep(p, ra);
    else ra.push(p);
  }
  return ra;
}

const tatCa = moiTep();
const tuongDoi = (p) => path.relative(GOC, p).split(path.sep).join('/');
const cacHtml = tatCa.filter((p) => /\.html?$/i.test(p));

console.log('KIỂM TRA KHO WEBSITE TĨNH');
console.log(`Thư mục: ${GOC}`);
console.log(`Tổng: ${tatCa.length} tệp, ${cacHtml.length} trang HTML`);

// ─────────────────────────────────────────────────────────────────────
nhom('1. Cấu trúc tối thiểu');

bao(fs.existsSync(path.join(GOC, 'index.html')),
  'có index.html ở gốc',
  'nginx phục vụ thư mục này — thiếu index.html là khách thấy trang 403');

bao(cacHtml.length > 0, 'có ít nhất một trang HTML');

// ─────────────────────────────────────────────────────────────────────
nhom('2. Trang có nội dung thật (không phải vỏ rỗng)');

// Bản sao hỏng kiểu "[object Object]" hay trang do JavaScript dựng đều cho ra
// tệp HTML HỢP LỆ nhưng KHÔNG CÓ CHỮ. Đo phần chữ sau khi bóc thẻ là cách rẻ
// nhất phát hiện cả hai.
for (const f of cacHtml) {
  const raw = fs.readFileSync(f, 'utf8');
  const ten = tuongDoi(f);

  if (raw.trim() === '[object Object]' || raw.length < 40) {
    bao(false, `${ten}: nội dung hỏng`, `chỉ ${raw.length} ký tự`);
    continue;
  }

  const chu = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (chu.length < 200) {
    // Không phải LỖI cứng: có trang chuyển hướng hợp lệ chỉ vài dòng.
    nhac(`${ten}: gần như không có chữ (${chu.length} ký tự)`,
      'trang dựng bằng JavaScript (React/Vue/Next) KHÔNG clone tĩnh được — bản sao sẽ là trang trắng');
  }
}
if (canhBao === 0) console.log('  ✓ mọi trang đều có nội dung chữ');

// ─────────────────────────────────────────────────────────────────────
nhom('3. Liên kết nội bộ trỏ tới tệp CÓ THẬT');

// Đây là chốt bắt được lỗi clone sót tệp — thứ mà báo cáo của công cụ clone
// không bao giờ nói ra.
const thieu = new Map();
let daSoat = 0;

for (const f of cacHtml) {
  const raw = fs.readFileSync(f, 'utf8');
  const thuMucTrang = path.dirname(f);

  const duongDan = [...raw.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (let d of duongDan) {
    d = d.trim();
    if (!d) continue;
    // Bỏ qua: tuyệt đối, neo, giao thức đặc biệt, ảnh nhúng.
    if (/^(https?:|\/\/|#|mailto:|tel:|sms:|javascript:|data:)/i.test(d)) continue;

    // Thực thể HTML trong URL là lỗi clone đã từng xảy ra -> giải mã trước khi tra.
    const sach = d.replace(/&amp;/gi, '&').split('#')[0].split('?')[0];
    if (!sach) continue;

    const dich = sach.startsWith('/')
      ? path.join(GOC, sach)
      : path.resolve(thuMucTrang, sach);

    daSoat++;
    const coThat = fs.existsSync(dich)
      || fs.existsSync(dich + '.html')
      || (fs.existsSync(dich) && fs.statSync(dich).isDirectory() && fs.existsSync(path.join(dich, 'index.html')));

    if (!coThat) {
      const khoa = tuongDoi(f);
      if (!thieu.has(khoa)) thieu.set(khoa, new Set());
      thieu.get(khoa).add(sach);
    }
  }
}

const tongThieu = [...thieu.values()].reduce((a, s) => a + s.size, 0);
if (tongThieu === 0) {
  bao(true, `${daSoat} liên kết nội bộ đều tồn tại`);
} else if (CFG.kiemTra?.chanLienKetHong === false) {
  nhac(`${tongThieu} liên kết nội bộ trỏ vào hư không`, 'đã tắt chặn trong site.config.json');
} else {
  bao(false, `${tongThieu} liên kết nội bộ trỏ vào hư không`,
    'bản sao thiếu tệp — trang sẽ vỡ ảnh / mất CSS');
  let dem = 0;
  for (const [trang, ds] of thieu) {
    for (const d of ds) {
      if (dem++ >= 15) break;
      console.log(`      ${trang} -> ${d}`);
    }
    if (dem >= 15) { console.log(`      … và ${tongThieu - 15} liên kết nữa`); break; }
  }
}

// ─────────────────────────────────────────────────────────────────────
nhom('4. Không lẫn bí mật vào kho');

// Kho website được đẩy lên GitHub và có thể chuyển thành công khai bất cứ lúc
// nào. Một khoá lọt vào đây là lọt vĩnh viễn — git giữ cả lịch sử.
const MAU_BI_MAT = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'khoá riêng SSH/TLS'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'khoá truy cập AWS'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'token GitHub'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'khoá API OpenAI'],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/, 'khoá API Google'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'token Slack'],
];

let dinhBiMat = false;
for (const f of tatCa) {
  if (fs.statSync(f).size > 2 * 1024 * 1024) continue;   // tệp nhị phân lớn: bỏ qua
  let noi;
  try { noi = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const [mau, ten] of MAU_BI_MAT) {
    if (mau.test(noi)) {
      bao(false, `${tuongDoi(f)}: có thứ trông như ${ten}`, 'GỠ NGAY rồi xoay vòng khoá đó');
      dinhBiMat = true;
    }
  }
}
if (!dinhBiMat) bao(true, 'không thấy khoá/token nào lẫn trong kho');

// ─────────────────────────────────────────────────────────────────────
nhom('5. Không còn dấu vết máy phát triển');

let dinhNoiBo = false;
for (const f of cacHtml) {
  const noi = fs.readFileSync(f, 'utf8');
  const m = noi.match(/(?:src|href)\s*=\s*["'](?:https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)[^"']*["']/i);
  if (m) { nhac(`${tuongDoi(f)}: còn trỏ về máy nội bộ`, m[0].slice(0, 80)); dinhNoiBo = true; }
  if (/\bfile:\/\/\//i.test(noi)) { nhac(`${tuongDoi(f)}: còn đường dẫn file:///`, 'khách sẽ không mở được'); dinhNoiBo = true; }
}
if (!dinhNoiBo) bao(true, 'không còn liên kết về localhost / file://');

// ─────────────────────────────────────────────────────────────────────
nhom('6. Kích thước tệp');

const tranMb = CFG.kiemTra?.toiDaMbMotTep || 25;
let qua = false;
for (const f of tatCa) {
  const mb = fs.statSync(f).size / 1024 / 1024;
  if (mb > tranMb) { nhac(`${tuongDoi(f)}: ${mb.toFixed(1)}MB`, `vượt ${tranMb}MB — tải chậm, và GitHub chặn ở 100MB`); qua = true; }
}
if (!qua) bao(true, `mọi tệp đều dưới ${tranMb}MB`);

const tongMb = tatCa.reduce((a, f) => a + fs.statSync(f).size, 0) / 1024 / 1024;
console.log(`  · tổng dung lượng: ${tongMb.toFixed(1)}MB`);

// ─────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`Kết quả: ${loi} lỗi, ${canhBao} cảnh báo`);

if (canhBao) {
  console.log('\nCẢNH BÁO (không chặn giao hàng, nhưng nên xem):');
  for (const c of dsCanhBao) console.log('  ⚠ ' + c);
}
if (loi) {
  console.log('\nLỖI CHẶN GIAO HÀNG:');
  for (const l of dsLoi) console.log('  ✗ ' + l);
  console.log('\nSửa xong rồi đẩy lại. Không giao bản sao hỏng cho khách.');
  process.exit(1);
}
console.log('✓ Kho đạt yêu cầu — giao hàng được.');
