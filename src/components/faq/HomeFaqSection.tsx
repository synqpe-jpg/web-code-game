import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useBranding } from '../../services/brandingService';

export const HomeFaqSection: React.FC = () => {
  const { t } = useLanguage();
  const branding = useBranding();
  const faqList = branding.faqList || [];

  const [openStates, setOpenStates] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
  });

  const toggleItem = (idx: number) => {
    setOpenStates((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  if (!Array.isArray(faqList) || faqList.length === 0) {
    return null;
  }

  return (
    <section id="home-faq-section" aria-labelledby="faq-heading" className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-gray-800/80">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-wider mb-2">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>FAQ & HỖ TRỢ</span>
        </div>
        <h2 id="faq-heading" className="text-lg sm:text-2xl font-black text-white tracking-tight">
          {t('faq.sectionTitle', 'Câu Hỏi Thường Gặp Khi Nhận Giftcode (FAQ)')}
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          {t('faq.sectionSubtitle', {
            brand: branding.brandDisplay,
            defaultValue: `Giải đáp các thắc mắc phổ biến về mã giftcode, bản quyền game và cách nhận quà tại ${branding.brandDisplay}`,
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {faqList.map((item, index) => {
          const isOpen = openStates[index] ?? true;
          return (
            <div
              key={index}
              className="rounded-xl border border-gray-800/90 bg-dark-900/70 p-4 sm:p-5 hover:border-brand-500/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-gray-100 text-sm leading-snug">
                    <span className="text-brand-400 font-mono mr-1.5">{index + 1}.</span>
                    {item.q}
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleItem(index)}
                    aria-expanded={isOpen}
                    className="md:hidden text-gray-400 hover:text-white p-1 -mr-1 -mt-1 cursor-pointer shrink-0"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
                <div className={`mt-2.5 text-xs text-gray-300 leading-relaxed ${isOpen ? 'block' : 'hidden md:block'}`}>
                  <p>{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
export default HomeFaqSection;
