
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';

interface ServiceQuoteProps {
    onClose: () => void;
}

const ServiceQuote: React.FC<ServiceQuoteProps> = ({ onClose }) => {
    const [currentDate, setCurrentDate] = useState('');

    useEffect(() => {
        const today = new Date();
        setCurrentDate(`${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`);
    }, []);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto">
            {/* Custom Styles cho Print - Nhúng trực tiếp vào component */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-quote, #printable-quote * {
                        visibility: visible;
                    }
                    #printable-quote {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        box-shadow: none;
                        background: white;
                    }
                    .no-print {
                        display: none !important;
                    }
                    /* Force background colors print */
                    .bg-blue-600 { background-color: #2563eb !important; -webkit-print-color-adjust: exact; }
                    .bg-blue-50 { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; }
                    .bg-green-600 { background-color: #16a34a !important; -webkit-print-color-adjust: exact; }
                    .bg-green-50 { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; }
                    .bg-orange-500 { background-color: #f97316 !important; -webkit-print-color-adjust: exact; }
                    .bg-gray-50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; }
                    .text-white { color: white !important; -webkit-print-color-adjust: exact; }
                }
                .a4-page {
                    width: 210mm;
                    min-height: 297mm;
                    padding: 20mm;
                    margin: 20px auto;
                    background: white;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    position: relative;
                }
                @media (max-width: 768px) {
                    .a4-page {
                        width: 100%;
                        margin: 0;
                        padding: 15px;
                        box-shadow: none;
                    }
                }
            `}</style>

            {/* Action Bar */}
            <div className="sticky top-0 left-0 w-full bg-white shadow-md p-4 flex justify-between items-center no-print z-50">
                <button 
                    onClick={onClose}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span>Quay lại</span>
                </button>
                <div className="flex flex-col items-end">
                    <button 
                        onClick={handlePrint} 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg flex items-center transition duration-300 shadow-sm active:scale-95"
                    >
                        <Printer size={20} className="mr-2" />
                        In / Lưu PDF
                    </button>
                </div>
            </div>

            {/* Main Document */}
            <div id="printable-quote" className="a4-page text-slate-800 font-sans">
                
                {/* Header */}
                <header className="flex justify-between items-start border-b-2 border-blue-600 pb-6 mb-8">
                    <div className="w-1/2">
                        <div className="text-3xl font-bold text-blue-700 uppercase tracking-wide mb-1">TAXMATE</div>
                        <p className="text-sm text-gray-500 italic">Dịch vụ Kế toán - Thuế Chuyên Nghiệp</p>
                    </div>
                    <div className="w-1/2 text-right">
                        <h1 className="text-2xl font-bold text-gray-800 uppercase">Bảng Báo Giá</h1>
                        <p className="text-gray-600 text-sm mt-1">Ngày: <span>{currentDate}</span></p>
                    </div>
                </header>

                {/* Greeting */}
                <section className="mb-8 text-sm text-gray-700 leading-relaxed">
                    <p className="mb-2"><strong>Kính gửi:</strong> Quý Khách hàng</p>
                    <p className="mb-4">Lời đầu tiên, <strong>Taxmate</strong> xin gửi lời chào trân trọng đến Quý khách hàng. Chúng tôi cam kết mang đến giải pháp tối ưu chi phí và đảm bảo tuân thủ pháp luật thuế cho doanh nghiệp của bạn.</p>
                </section>

                {/* Section 1: Micro Enterprise */}
                <section className="mb-8">
                    <div className="flex items-center mb-4">
                        <div className="bg-blue-600 text-white p-1 rounded mr-2 flex items-center justify-center w-7 h-7">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-blue-800 uppercase">I. Gói Doanh Nghiệp Siêu Nhỏ (Dưới 3 Tỷ/Năm)</h2>
                    </div>
                    
                    <div className="overflow-hidden border rounded-lg mb-4">
                        <table className="min-w-full text-sm">
                            <thead className="bg-blue-50">
                                <tr>
                                    <th className="py-2 px-4 text-left text-blue-800 font-semibold border-b">Phân loại</th>
                                    <th className="py-2 px-4 text-left text-blue-800 font-semibold border-b">Số lượng hóa đơn</th>
                                    <th className="py-2 px-4 text-right text-blue-800 font-semibold border-b">Phí dịch vụ (VNĐ/tháng)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                <tr>
                                    <td className="py-2 px-4 font-medium text-gray-800">Không phát sinh</td>
                                    <td className="py-2 px-4 text-gray-600">0 hóa đơn (Báo cáo trắng)</td>
                                    <td className="py-2 px-4 text-right font-bold text-blue-600">500.000 đ</td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="py-2 px-4 font-medium text-gray-800">Rất ít</td>
                                    <td className="py-2 px-4 text-gray-600">Dưới 10 hóa đơn</td>
                                    <td className="py-2 px-4 text-right font-bold text-blue-600">1.000.000 đ</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-4 font-medium text-gray-800">Trung bình</td>
                                    <td className="py-2 px-4 text-gray-600">10 – 30 hóa đơn</td>
                                    <td className="py-2 px-4 text-right font-bold text-blue-600">1.500.000 – 2.000.000 đ</td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="py-2 px-4 font-medium text-gray-800">Nhiều</td>
                                    <td className="py-2 px-4 text-gray-600">30 – 60 hóa đơn</td>
                                    <td className="py-2 px-4 text-right font-bold text-blue-600">2.000.000 – 3.000.000 đ</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Work scope */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                        <h3 className="font-bold text-gray-800 mb-2">Quyền lợi & Công việc thực hiện:</h3>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-gray-600 list-disc list-inside">
                            <li>Nhận chứng từ, kiểm tra tính hợp lệ.</li>
                            <li>Kê khai thuế GTGT, TNCN.</li>
                            <li>Báo cáo tình hình sử dụng hóa đơn.</li>
                            <li>Hỗ trợ rà soát sổ sách kế toán.</li>
                            <li><strong>Quyết toán thuế & BCTC năm.</strong></li>
                        </ul>
                        <p className="text-xs text-red-500 mt-2 italic">* Phí BCTC cuối năm: 5.000.000đ tuỳ tình hình.</p>
                    </div>
                </section>

                {/* Section 2: Household Business & Add-on */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Household Business */}
                    <section>
                        <div className="flex items-center mb-4">
                            <div className="bg-green-600 text-white p-1 rounded mr-2 flex items-center justify-center w-7 h-7">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-green-700 uppercase">II. Hộ Kinh Doanh (HKD)</h2>
                        </div>
                        <table className="w-full text-sm border mb-4">
                            <thead className="bg-green-50">
                                <tr>
                                    <th className="py-2 px-2 text-left text-green-800 font-semibold border-b">Phân loại</th>
                                    <th className="py-2 px-2 text-right text-green-800 font-semibold border-b">Chi phí / tháng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr>
                                    <td className="py-2 px-2 text-gray-600">Ít phát sinh (&lt; 500 triệu)</td>
                                    <td className="py-2 px-2 text-right font-bold text-green-600">500.000 – 800.000 đ</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-2 text-gray-600">Doanh thu &lt; 1 tỷ</td>
                                    <td className="py-2 px-2 text-right font-bold text-green-600">1.000.000 – 1.500.000 đ</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-2 text-gray-600">DT 1-3 tỷ (Tồn kho)</td>
                                    <td className="py-2 px-2 text-right font-bold text-green-600">1.500.000 – 2.500.000 đ</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="text-xs text-gray-500 italic">Bao gồm: Kê khai thuế, Sổ doanh thu/chi phí/tồn kho, Tư vấn xuất HĐ điện tử.</p>
                    </section>

                    {/* Add-on Services */}
                    <section>
                        <div className="flex items-center mb-4">
                            <div className="bg-orange-500 text-white p-1 rounded mr-2 flex items-center justify-center w-7 h-7">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-orange-600 uppercase">III. Dịch Vụ Khác</h2>
                        </div>
                        <ul className="space-y-3 text-sm">
                            <li className="flex justify-between items-start border-b border-dashed border-slate-300 pb-2">
                                <span className="text-gray-700">Thành lập DN/HKD mới</span>
                                <span className="font-bold text-orange-600 whitespace-nowrap">1.000.000 – 2.500.000 đ</span>
                            </li>
                            <li className="flex justify-between items-start border-b border-dashed border-slate-300 pb-2">
                                <span className="text-gray-700">Dịch vụ BHXH (Lần đầu)</span>
                                <span className="font-bold text-orange-600 whitespace-nowrap">1.000.000 – 1.500.000 đ</span>
                            </li>
                            <li className="flex justify-between items-start border-b border-dashed border-slate-300 pb-2">
                                <span className="text-gray-700">Dọn dẹp sổ sách cũ</span>
                                <span className="font-bold text-gray-500 italic">Thương lượng</span>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Footer */}
                <footer className="text-center border-t-2 border-gray-200 pt-6 mt-auto">
                    <h4 className="font-bold text-gray-800 text-lg mb-2">LIÊN HỆ TƯ VẤN</h4>
                    <div className="flex justify-center space-x-8 text-sm text-gray-600">
                        <p>📞 <strong>Hotline/Zalo:</strong> 098 335 9788</p>
                        <p>📧 <strong>Email:</strong> admin@taxmate.vn</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Rất hân hạnh được đồng hành cùng sự phát triển của Quý khách!</p>
                </footer>
            </div>
        </div>
    );
};

export default ServiceQuote;
