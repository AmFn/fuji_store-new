import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Plus, Search, Edit3, Share2, Film, Sun, Zap, Target, Palette, Moon, Layers, Droplets } from 'lucide-react';
import { Recipe, Photo, User } from '../../types';
import { FILM_MODES } from '../../constants/filmModes';
import { cn } from '../../lib/utils';
import { CustomSelect } from '../common/CustomSelect';

interface RecipeViewProps {
  recipes: Recipe[];
  photos: Photo[];
  user: User | null;
  theme: string;
  onAddRecipe: (recipe: Recipe) => void;
}

export function RecipeView({ recipes, photos, user, theme, onAddRecipe }: RecipeViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>({
    name: '',
    filmMode: 'Classic Chrome',
    whiteBalance: 'Auto',
    dynamicRange: 'DR100',
    sharpness: '0',
    color: '0',
    highlightTone: '0',
    shadowTone: '0',
    colorChromeEffect: 'Off',
    colorChromeEffectBlue: 'Off',
    isFavorite: false,
    ownerId: user?.uid || 'demo'
  });

  const handleCreate = async () => {
    if (!newRecipe.name) return;
    const recipe: Recipe = {
      ...newRecipe as Recipe,
      id: `r-${Date.now()}`
    };
    onAddRecipe(recipe);
    setIsCreating(false);
    setNewRecipe({ 
      name: '', 
      filmMode: 'Classic Chrome', 
      whiteBalance: 'Auto',
      dynamicRange: 'DR100',
      sharpness: '0',
      color: '0',
      highlightTone: '0',
      shadowTone: '0',
      colorChromeEffect: 'Off',
      colorChromeEffectBlue: 'Off',
      isFavorite: false, 
      ownerId: user?.uid || 'demo' 
    });
  };

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.filmMode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);
  const recipePhotos = photos.filter(p => p.recipeId === selectedRecipeId);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Film Recipes</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage your custom film simulations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search recipes..."
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-blue-500 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Recipe List */}
        <div className={cn("space-y-6", selectedRecipeId ? "lg:col-span-4" : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 space-y-0")}>
          {filteredRecipes.map(recipe => (
            <motion.div 
              layout
              key={recipe.id} 
              onClick={() => setSelectedRecipeId(recipe.id === selectedRecipeId ? null : recipe.id)}
              className={cn(
                "glass-card rounded-3xl p-8 space-y-6 group cursor-pointer transition-all border-2",
                selectedRecipeId === recipe.id ? "border-blue-500 ring-4 ring-blue-500/10" : "border-transparent hover:border-blue-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-black text-xl tracking-tight">{recipe.name}</h3>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{recipe.filmMode}</p>
                </div>
                <Heart className={cn("w-6 h-6 transition-all", recipe.isFavorite ? "text-red-500 fill-red-500" : "text-slate-300 group-hover:text-red-500/50")} />
              </div>
              
              {!selectedRecipeId && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black border bg-slate-500/5 text-slate-500 border-[var(--border-color)]">
                    <span className="uppercase tracking-widest opacity-60">WB</span>
                    <span className="uppercase tracking-widest">{recipe.whiteBalance}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black border bg-slate-500/5 text-slate-500 border-[var(--border-color)]">
                    <span className="uppercase tracking-widest opacity-60">DR</span>
                    <span className="uppercase tracking-widest">{recipe.dynamicRange}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black border bg-slate-500/5 text-slate-500 border-[var(--border-color)]">
                    <span className="uppercase tracking-widest opacity-60">Sharp</span>
                    <span className="uppercase tracking-widest">{recipe.sharpness}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black border bg-slate-500/5 text-slate-500 border-[var(--border-color)]">
                    <span className="uppercase tracking-widest opacity-60">Color</span>
                    <span className="uppercase tracking-widest">{recipe.saturation}</span>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {photos.filter(p => p.recipeId === recipe.id).length} photos
                </span>
                <div className="flex items-center gap-2 text-blue-500">
                  <span className="text-[10px] font-black uppercase tracking-widest">Details</span>
                  <Edit3 className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recipe Details Panel */}
        {selectedRecipeId && selectedRecipe && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-8 space-y-10"
          >
            <div className="glass-card rounded-[2.5rem] p-10 space-y-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                    <Film className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">{selectedRecipe.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {selectedRecipe.filmMode}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Created by you</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]">
                    <Edit3 className="w-5 h-5 text-slate-400" />
                  </button>
                  <button className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]">
                    <Share2 className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'White Balance', value: selectedRecipe.whiteBalance, icon: <Sun className="w-4 h-4" /> },
                  { label: 'Dynamic Range', value: selectedRecipe.dynamicRange, icon: <Zap className="w-4 h-4" /> },
                  { label: 'Sharpness', value: selectedRecipe.sharpness, icon: <Target className="w-4 h-4" /> },
                  { label: 'Color', value: selectedRecipe.saturation, icon: <Palette className="w-4 h-4" /> },
                  { label: 'Highlight', value: selectedRecipe.highlightTone, icon: <Sun className="w-4 h-4" /> },
                  { label: 'Shadow', value: selectedRecipe.shadowTone, icon: <Moon className="w-4 h-4" /> },
                  { label: 'Chrome FX', value: selectedRecipe.colorChromeEffect, icon: <Layers className="w-4 h-4" /> },
                  { label: 'FX Blue', value: selectedRecipe.colorChromeEffectBlue, icon: <Droplets className="w-4 h-4" /> },
                ].map(stat => (
                  <div key={stat.label} className="p-6 bg-slate-500/5 rounded-3xl border border-[var(--border-color)] space-y-3">
                    <div className="flex items-center gap-2 text-slate-400">
                      {stat.icon}
                      <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <p className="text-xl font-black">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Photos using this recipe</h3>
                  <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline">View All</button>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                  {recipePhotos.slice(0, 5).map(photo => (
                    <div key={photo.id} className="aspect-square rounded-2xl overflow-hidden bg-slate-500/10 group relative">
                      <img src={photo.thumbnailUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Edit3 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ))}
                  {recipePhotos.length === 0 && (
                    <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-500/10 rounded-3xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No photos yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight">New Recipe</h2>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
                  <Edit3 className="w-6 h-6" />
                </button>
              </div>
              <div className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipe Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
                    placeholder="e.g. Kodachrome 64"
                    value={newRecipe.name}
                    onChange={e => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Film Mode</label>
                    <CustomSelect 
                      value={newRecipe.filmMode}
                      onChange={(val) => setNewRecipe({ ...newRecipe, filmMode: val })}
                      options={FILM_MODES.map(m => ({ label: m, value: m }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">White Balance</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="Auto"
                      value={newRecipe.whiteBalance}
                      onChange={e => setNewRecipe({ ...newRecipe, whiteBalance: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Highlight</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="0"
                      value={newRecipe.highlightTone}
                      onChange={e => setNewRecipe({ ...newRecipe, highlightTone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shadow</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
                      placeholder="0"
                      value={newRecipe.shadowTone}
                      onChange={e => setNewRecipe({ ...newRecipe, shadowTone: e.target.value })}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleCreate}
                  disabled={!newRecipe.name}
                  className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                  Create Recipe
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}