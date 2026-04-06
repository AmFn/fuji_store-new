import React from 'react';
import { X, ChevronRight, BookOpen, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { cn } from '../../lib/utils';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentationModal({ isOpen, onClose }: DocumentationModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[90vw] max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('metadata.docTitle') || '富士胶片模拟参数指南'}</h2>
              <p className="text-xs text-slate-400">{t('metadata.docSubtitle') || '了解各参数的含义和使用方法'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-64 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <nav className="space-y-1">
              <NavItem id="overview" label={t('metadata.docOverview') || '概述'} />
              <NavItem id="film-simulation" label={t('metadata.docFilmSim') || '胶片模拟'} />
              <NavItem id="white-balance" label={t('metadata.docWB') || '白平衡'} />
              <NavItem id="dynamic-range" label={t('metadata.docDR') || '动态范围'} />
              <NavItem id="tone-curve" label={t('metadata.docTone') || '色调曲线'} />
              <NavItem id="color-sharpness" label={t('metadata.docColor') || '色彩与锐度'} />
              <NavItem id="grain-effect" label={t('metadata.docGrain') || '颗粒效果'} />
              <NavItem id="color-chrome" label={t('metadata.docChrome') || '色彩效果'} />
              <NavItem id="recipes" label={t('metadata.docRecipes') || '配方推荐'} />
              <NavItem id="json-fields" label={t('metadata.docJsonFields') || 'JSON字段说明'} />
              <NavItem id="tips" label={t('metadata.docTips') || '使用技巧'} />
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Section id="overview" title={t('metadata.docOverview') || '概述'}>
                <p>富士相机提供强大的胶片模拟功能，模拟传统胶片的色彩表现。本文详细介绍各参数的含义和使用方法。</p>
              </Section>

              <Section id="film-simulation" title={t('metadata.docFilmSim') || '胶片模拟'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FilmSimCard 
                    name="PROVIA" 
                    cnName="标准" 
                    desc="富士默认标准模式，色彩还原自然，适合风景和人像" 
                    tags={['通用', '风景', '人像']}
                  />
                  <FilmSimCard 
                    name="Velvia" 
                    cnName="鲜艳" 
                    desc="高饱和度、高对比度，色彩非常鲜艳" 
                    tags={['风景', '夕阳']}
                  />
                  <FilmSimCard 
                    name="ASTIA" 
                    cnName="柔和" 
                    desc="柔和色调，肤色表现优异" 
                    tags={['人像', '婚礼']}
                  />
                  <FilmSimCard 
                    name="CLASSIC CHROME" 
                    cnName="经典正片" 
                    desc="低饱和度、高对比，呈现复古电影感" 
                    tags={['街拍', '纪实']}
                  />
                  <FilmSimCard 
                    name="ETERNA" 
                    cnName="影院" 
                    desc="电影质感，低饱和度、长调曝光" 
                    tags={['视频', '电影感']}
                  />
                  <FilmSimCard 
                    name="ACROS" 
                    cnName="黑白" 
                    desc="黑白模式，细腻颗粒感" 
                    tags={['黑白', '艺术']}
                  />
                </div>
              </Section>

              <Section id="white-balance" title={t('metadata.docWB') || '白平衡'}>
                <h4>预设白平衡</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 pr-4">预设</th>
                        <th className="text-left py-2 pr-4">色温</th>
                        <th className="text-left py-2">适用场景</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="py-2 pr-4">日光</td><td className="pr-4">5200K</td><td>阳光明媚的户外</td></tr>
                      <tr><td className="py-2 pr-4">阴天</td><td className="pr-4">6000K</td><td>阴天户外</td></tr>
                      <tr><td className="py-2 pr-4">荧光灯</td><td className="pr-4">4000-5000K</td><td>室内荧光灯</td></tr>
                      <tr><td className="py-2 pr-4">钨丝灯</td><td className="pr-4">3000K</td><td>室内钨丝灯</td></tr>
                      <tr><td className="py-2 pr-4">闪光灯</td><td className="pr-4">5500K</td><td>使用闪光灯</td></tr>
                    </tbody>
                  </table>
                </div>
                <h4>白平衡偏移</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-mono text-blue-500">R (红)</span>: +增强红色，-增强青色<br />
                  <span className="font-mono text-blue-500">B (蓝)</span>: +增强蓝色，-增强黄色<br />
                  <span className="text-slate-400">范围: -9 到 +9</span>
                </p>
              </Section>

              <Section id="dynamic-range" title={t('metadata.docDR') || '动态范围'}>
                <div className="space-y-3">
                  <DrCard 
                    name="DR100" 
                    desc="无动态范围扩展，适合高调场景（整体明亮的照片）" 
                    note="标准模式"
                  />
                  <DrCard 
                    name="DR200" 
                    desc="扩展动态范围约2档，适合中间调为主的场景" 
                    note="ISO 400+"
                  />
                  <DrCard 
                    name="DR400" 
                    desc="扩展动态范围约4档，适合大光比场景（明暗对比强烈）" 
                    note="ISO 800+"
                  />
                </div>
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    <strong>注意:</strong> DR400会降低ISO可用范围
                  </p>
                </div>
              </Section>

              <Section id="tone-curve" title={t('metadata.docTone') || '色调曲线'}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <h4 className="font-bold text-sm mb-2">高光 (Highlight)</h4>
                    <p className="text-xs text-slate-500 mb-2">调整高光区域亮度</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded">+值</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-600">高光更亮，细节更多</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded">-值</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-600">高光更暗，压高光</span>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <h4 className="font-bold text-sm mb-2">阴影 (Shadow)</h4>
                    <p className="text-xs text-slate-500 mb-2">调整阴影区域亮度</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded">+值</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-600">阴影更亮，提亮暗部</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded">-值</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-600">阴影更暗，增加对比</span>
                    </div>
                  </div>
                </div>
              </Section>

              <Section id="color-sharpness" title={t('metadata.docColor') || '色彩与锐度'}>
                <div className="space-y-3">
                  <SettingCard name="色彩饱和度 (Color)" range="-4 到 +4" 
                    positive="增加饱和度" 
                    negative="降低饱和度" 
                    note="负值适合人像后期"
                  />
                  <SettingCard name="锐度 (Sharpness)" range="-4 到 +4" 
                    positive="边缘更锐利" 
                    negative="画面更柔和" 
                    note="-4到-1适合人像"
                  />
                  <SettingCard name="降噪 (Noise Reduction)" range="-4 到 +4" 
                    positive="降噪更强" 
                    negative="保留更多细节" 
                    note="高ISO时注意噪点"
                  />
                  <SettingCard name="清晰度 (Clarity)" range="-5 到 +5" 
                    positive="增加立体感" 
                    negative="柔和效果" 
                    note="增加微对比度"
                  />
                </div>
              </Section>

              <Section id="grain-effect" title={t('metadata.docGrain') || '颗粒效果'}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <h4 className="font-bold text-sm mb-2">粗糙度 (Roughness)</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">弱</span>
                        <span className="text-slate-400">→</span>
                        <span>细腻颗粒</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">强</span>
                        <span className="text-slate-400">→</span>
                        <span>明显颗粒</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <h4 className="font-bold text-sm mb-2">颗粒大小 (Size)</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">小</span>
                        <span className="text-slate-400">→</span>
                        <span>细腻质感</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">大</span>
                        <span className="text-slate-400">→</span>
                        <span>粗犷效果</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section id="color-chrome" title={t('metadata.docChrome') || '色彩效果'}>
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <h4 className="font-bold text-sm mb-2">色彩效果 (Color Chrome)</h4>
                    <p className="text-xs text-slate-500 mb-2">增强色彩浓度，特别是红色和黄色</p>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">关闭</span>
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">弱</span>
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">强</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">适用于高饱和度场景，避免过曝</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <h4 className="font-bold text-sm mb-2">蓝色色彩效果 (Color Chrome FX Blue)</h4>
                    <p className="text-xs text-slate-500 mb-2">专门增强蓝色表现</p>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">关闭</span>
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">弱</span>
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">强</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">适合拍摄天空和水体</p>
                  </div>
                </div>
              </Section>

              <Section id="recipes" title={t('metadata.docRecipes') || '配方推荐'}>
                <RecipeCard 
                  name="经典电影感"
                  params={['胶片模拟: CLASSIC CHROME', '动态范围: DR200', '高光: -1', '阴影: +2', '色彩: -2', '清晰度: +2', '颗粒效果: 弱/小']}
                />
                <RecipeCard 
                  name="风光摄影"
                  params={['胶片模拟: Velvia', '动态范围: DR200', '高光: -1', '阴影: -1', '色彩: +2', '锐度: +2']}
                />
                <RecipeCard 
                  name="人像摄影"
                  params={['胶片模拟: PRO Neg. Std', '白平衡: 自动或日光', '清晰度: -1', '色彩: -1', '颗粒效果: 关闭']}
                />
              </Section>

              <Section id="json-fields" title={t('metadata.docJsonFields') || 'JSON字段说明'}>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  以下是应用程序中使用的参数字段与富士相机 EXIF 元数据的对应关系，基于 FujiFilm 官方规范。
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 pr-4">内部键名</th>
                        <th className="text-left py-2 pr-4">显示名称</th>
                        <th className="text-left py-2 pr-4">JSON路径</th>
                        <th className="text-left py-2 pr-4">EXIF标签</th>
                        <th className="text-left py-2">说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">filmSimulation</td>
                        <td className="py-2 pr-4">胶片模拟</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">FilmMode</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1401</td>
                        <td className="py-2 text-slate-500">胶片模拟模式，如 PROVIA、Velvia、ASTIA、CLASSIC CHROME、ETERNA 等</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">whiteBalance</td>
                        <td className="py-2 pr-4">白平衡</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">WhiteBalance</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1002</td>
                        <td className="py-2 text-slate-500">白平衡预设：自动、日光、阴天、荧光灯、白炽灯、开尔文等</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">whiteBalanceShiftR</td>
                        <td className="py-2 pr-4">白平衡红色偏移</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">WBShiftR</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x144a</td>
                        <td className="py-2 text-slate-500">白平衡微调红色通道，范围 -9 到 +9</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">whiteBalanceShiftB</td>
                        <td className="py-2 pr-4">白平衡蓝色偏移</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">WBShiftB</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x144c</td>
                        <td className="py-2 text-slate-500">白平衡微调蓝色通道，范围 -9 到 +9</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">whiteBalanceShift</td>
                        <td className="py-2 pr-4">白平衡偏移(组合)</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">WBShift</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x100a</td>
                        <td className="py-2 text-slate-500">组合字段，同时存储 R 和 B 偏移值</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">dynamicRange</td>
                        <td className="py-2 pr-4">动态范围</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">DynamicRange</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1400</td>
                        <td className="py-2 text-slate-500">动态范围设置：DR100、DR200、DR400</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">sharpness</td>
                        <td className="py-2 pr-4">锐度</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">Sharpness</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1001</td>
                        <td className="py-2 text-slate-500">锐度调整，范围 -4 到 +4 (0=标准)</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">saturation</td>
                        <td className="py-2 pr-4">饱和度</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">Saturation</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1003</td>
                        <td className="py-2 text-slate-500">色彩饱和度调整，范围 -4 到 +4 (0=标准)</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">contrast</td>
                        <td className="py-2 pr-4">对比度</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">Contrast</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1004/0x1006</td>
                        <td className="py-2 text-slate-500">对比度调整，范围 -4 到 +4 (0=标准)</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">highlightTone</td>
                        <td className="py-2 pr-4">高光</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">Highlight</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1041</td>
                        <td className="py-2 text-slate-500">高光色调调整，范围 -2 到 +4 (0=标准)</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">shadowTone</td>
                        <td className="py-2 pr-4">阴影</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">Shadow</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1040</td>
                        <td className="py-2 text-slate-500">阴影色调调整，范围 -2 到 +4 (0=标准)</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">noiseReduction</td>
                        <td className="py-2 pr-4">降噪</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">NoiseReduction</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x100e</td>
                        <td className="py-2 text-slate-500">降噪强度，范围 -4 到 +4 (0=标准)</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">clarity</td>
                        <td className="py-2 pr-4">清晰度</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">Clarity</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x100f</td>
                        <td className="py-2 text-slate-500">清晰度/清晰度调整，范围 -5 到 +5</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">grainEffect</td>
                        <td className="py-2 pr-4">颗粒效果</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">GrainEffect</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1047/0x104c</td>
                        <td className="py-2 text-slate-500">颗粒效果：Roughness(粗糙度) + Size(大小)，如 "Off, Off"、"Weak, Small"</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">colorChromeEffect</td>
                        <td className="py-2 pr-4">色彩效果</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">ColorChromeEffect</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x1048</td>
                        <td className="py-2 text-slate-500">色彩chrome效果：Off、Weak(弱)、Strong(强)</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-blue-500">colorChromeEffectBlue</td>
                        <td className="py-2 pr-4">蓝色色彩效果</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">ColorChromeEffectBlue</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">0x104e</td>
                        <td className="py-2 text-slate-500">蓝色色彩chrome效果：Off、Weak(弱)、Strong(强)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    <strong>数据来源：</strong> EXIF 元数据标签基于 <a href="https://exiftool.org/TagNames/FujiFilm.html" target="_blank" rel="noopener noreferrer" className="underline">exiftool.org FujiFilm Tags 规范</a>
                  </p>
                </div>
              </Section>

              <Section id="tips" title={t('metadata.docTips') || '使用技巧'}>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc pl-4">
                  <li><strong>包围拍摄:</strong> 同一场景使用不同配方拍摄</li>
                  <li><strong>RAW+JPEG:</strong> JPEG用配方，RAW保留后期空间</li>
                  <li><strong>ISO限制:</strong> 使用高DR模式时注意ISO限制</li>
                  <li><strong>直方图:</strong> 经常检查直方图避免过曝</li>
                  <li><strong>练习:</strong> 多尝试不同组合，找到自己的风格</li>
                </ul>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ id, label }: { id: string; label: string }) {
  const handleClick = () => {
    const element = document.getElementById(`section-${id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left"
    >
      <ChevronRight className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`section-${id}`} className="mb-8 scroll-mt-4">
      <h3 className="text-lg font-bold mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">{title}</h3>
      {children}
    </section>
  );
}

function FilmSimCard({ name, cnName, desc, tags }: { name: string; cnName: string; desc: string; tags: string[] }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold text-sm text-blue-500">{name}</span>
        <span className="text-xs text-slate-400">/</span>
        <span className="text-xs text-slate-500">{cnName}</span>
      </div>
      <p className="text-xs text-slate-500 mb-2">{desc}</p>
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">{tag}</span>
        ))}
      </div>
    </div>
  );
}

function DrCard({ name, desc, note }: { name: string; desc: string; note: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-start justify-between">
      <div>
        <span className="font-bold text-sm">{name}</span>
        <p className="text-xs text-slate-500 mt-1">{desc}</p>
      </div>
      <span className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-500 rounded whitespace-nowrap">{note}</span>
    </div>
  );
}

function SettingCard({ name, range, positive, negative, note }: { name: string; range: string; positive: string; negative: string; note: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm">{name}</span>
        <span className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">{range}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <span className="text-blue-500">+</span>
        <span>{positive}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
        <span className="text-red-500">-</span>
        <span>{negative}</span>
      </div>
      <p className="text-[10px] text-slate-400">{note}</p>
    </div>
  );
}

function RecipeCard({ name, params }: { name: string; params: string[] }) {
  return (
    <div className="p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-xl mb-3">
      <h4 className="font-bold text-sm mb-2">{name}</h4>
      <div className="grid grid-cols-2 gap-1 text-xs">
        {params.map((param, i) => (
          <span key={i} className="text-slate-600 dark:text-slate-400">{param}</span>
        ))}
      </div>
    </div>
  );
}
