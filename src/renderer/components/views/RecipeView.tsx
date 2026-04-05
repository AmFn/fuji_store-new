import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Plus, Search, Edit3, Share2, Film, Eye, ChevronRight, X, Trash2 } from 'lucide-react';
import { Recipe, Photo, User } from '../../types';
import { FILM_MODES } from '../../constants/filmModes';
import { cn } from '../../lib/utils';
import { CustomSelect } from '../common/CustomSelect';
import { FilmTag } from '../common/FilmTag';
import { FilmSettingCard } from '../common/FilmSettingCard';
import { recipeService } from '../../services/recipeService';
import { ConfirmModal } from '../modals/ConfirmModal';

interface RecipeViewProps {
  recipes: Recipe[];
  photos: Photo[];
  user: User | null;
  theme: string;
  onRecipesChange: (recipes: Recipe[]) => void;
}

export function RecipeView({ recipes, photos, user, theme, onRecipesChange }: RecipeViewProps) {
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>({
    name: '',
    filmMode: 'Classic Chrome',
    whiteBalance: 'Auto',
    whiteBalanceShift: '0, 0',
    dynamicRange: 'DR100',
    sharpness: '0',
    saturation: '0',
    contrast: '0',
    highlightTone: '0',
    shadowTone: '0',
    noiseReduction: '0',
    clarity: '0',
    grainEffect: 'Off, Off',
    colorChromeEffect: 'Off',
    colorChromeEffectBlue: 'Off',
    isFavorite: false,
    ownerId: user?.uid || 'local'
  });

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    setLoading(true);
    const loadedRecipes = await recipeService.loadAllRecipes();
    onRecipesChange(loadedRecipes);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newRecipe.name) return;
    const created = await recipeService.createRecipe(newRecipe);
    if (created) {
      onRecipesChange([...recipes, created]);
      setIsCreating(false);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editingRecipe) return;
    const success = await recipeService.updateRecipe(editingRecipe);
    if (success) {
      onRecipesChange(recipes.map(r => r.id === editingRecipe.id ? editingRecipe : r));
      setEditingRecipe(null);
    }
  };

  const handleDelete = async (recipeId: string) => {
    const success = await recipeService.deleteRecipe(recipeId);
    if (success) {
      onRecipesChange(recipes.filter(r => r.id !== recipeId));
      if (selectedRecipeId === recipeId) {
        setSelectedRecipeId(null);
      }
    }
    setShowDeleteConfirm(null);
  };

  const handleToggleFavorite = async (recipeId: string) => {
    const success = await recipeService.toggleFavorite(recipeId);
    if (success) {
      onRecipesChange(recipes.map(r => 
        r.id === recipeId ? { ...r, isFavorite: !r.isFavorite } : r
      ));
    }
  };

  const resetForm = () => {
    setNewRecipe({
      name: '',
      filmMode: 'Classic Chrome',
      whiteBalance: 'Auto',
      whiteBalanceShift: '0, 0',
      dynamicRange: 'DR100',
      sharpness: '0',
      saturation: '0',
      contrast: '0',
      highlightTone: '0',
      shadowTone: '0',
      noiseReduction: '0',
      clarity: '0',
      grainEffect: 'Off, Off',
      colorChromeEffect: 'Off',
      colorChromeEffectBlue: 'Off',
      isFavorite: false,
      ownerId: user?.uid || 'local'
    });
  };

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.filmMode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);
  const recipePhotos = photos.filter(p => p.recipeId === selectedRecipeId);

  const renderRecipeForm = (recipe: Partial<Recipe>, setRecipe: (r: Partial<Recipe>) => void, onSubmit: () => void, submitLabel: string) => (
    <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipe Name</label>
        <input 
          type="text" 
          className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
          placeholder="e.g. Kodachrome 64"
          value={recipe.name || ''}
          onChange={e => setRecipe({ ...recipe, name: e.target.value })}
        />
      </div>
      
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
        <textarea 
          className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold min-h-[80px]"
          placeholder="Brief description of this recipe..."
          value={recipe.description || ''}
          onChange={e => setRecipe({ ...recipe, description: e.target.value })}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Film Mode</label>
            <CustomSelect 
              value={recipe.filmMode || ''}
              onChange={(val) => setRecipe({ ...recipe, filmMode: val })}
              options={FILM_MODES.map(m => ({ label: m, value: m }))}
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">White Balance</label>
            <input 
              type="text" 
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
              placeholder="Auto"
              value={recipe.whiteBalance || ''}
              onChange={e => setRecipe({ ...recipe, whiteBalance: e.target.value })}
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WB Shift (R, B)</label>
            <input 
              type="text" 
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
              placeholder="0, 0"
              value={recipe.whiteBalanceShift || ''}
              onChange={e => setRecipe({ ...recipe, whiteBalanceShift: e.target.value })}
            />
          </div>
          <Slider 
            label="Sharpness" 
            value={Number(recipe.sharpness || 0)} 
            onChange={(val) => setRecipe({ ...recipe, sharpness: val.toString() })} 
          />
          <Slider 
            label="Color" 
            value={Number(recipe.saturation || 0)} 
            onChange={(val) => setRecipe({ ...recipe, saturation: val.toString() })} 
          />
          <Slider 
            label="Noise Reduction" 
            value={Number(recipe.noiseReduction || 0)} 
            onChange={(val) => setRecipe({ ...recipe, noiseReduction: val.toString() })} 
          />
          <Slider 
            label="Clarity" 
            value={Number(recipe.clarity || 0)} 
            onChange={(val) => setRecipe({ ...recipe, clarity: val.toString() })} 
          />
        </div>

        <div className="space-y-6">
          <Slider 
            label="Highlight" 
            value={Number(recipe.highlightTone || 0)} 
            onChange={(val) => setRecipe({ ...recipe, highlightTone: val.toString() })} 
          />
          <Slider 
            label="Shadow" 
            value={Number(recipe.shadowTone || 0)} 
            onChange={(val) => setRecipe({ ...recipe, shadowTone: val.toString() })} 
          />
          <Slider 
            label="Contrast" 
            value={Number(recipe.contrast || 0)} 
            onChange={(val) => setRecipe({ ...recipe, contrast: val.toString() })} 
          />
          <Switch 
            label="Chrome FX" 
            checked={recipe.colorChromeEffect === 'On'} 
            onChange={(val) => setRecipe({ ...recipe, colorChromeEffect: val ? 'On' : 'Off' })} 
          />
          <Switch 
            label="FX Blue" 
            checked={recipe.colorChromeEffectBlue === 'On'} 
            onChange={(val) => setRecipe({ ...recipe, colorChromeEffectBlue: val ? 'On' : 'Off' })} 
          />
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grain Effect (Roughness, Size)</label>
            <input 
              type="text" 
              className="w-full bg-slate-500/5 border border-[var(--border-color)] rounded-2xl px-6 py-4 focus:outline-none font-bold"
              placeholder="Off, Off"
              value={recipe.grainEffect || ''}
              onChange={e => setRecipe({ ...recipe, grainEffect: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">
          Loading recipes...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0">
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
            onClick={() => { resetForm(); setIsCreating(true); }}
            className="bg-blue-500 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className={cn(
          "h-full overflow-y-auto pr-4 custom-scrollbar space-y-6", 
          selectedRecipeId ? "lg:col-span-4" : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 space-y-0"
        )}>
          {filteredRecipes.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 space-y-6">
              <div className="w-20 h-20 bg-slate-500/5 rounded-full flex items-center justify-center">
                <Film className="w-10 h-10 opacity-20" />
              </div>
              <p className="font-medium">No recipes found</p>
              <button 
                onClick={() => { resetForm(); setIsCreating(true); }}
                className="text-blue-500 hover:underline"
              >
                Create your first recipe
              </button>
            </div>
          ) : (
            filteredRecipes.map(recipe => (
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
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite(recipe.id); }}
                    className="p-1"
                  >
                    <Heart className={cn("w-6 h-6 transition-all", recipe.isFavorite ? "text-red-500 fill-red-500" : "text-slate-300 group-hover:text-red-500/50")} />
                  </button>
                </div>
                
                {!selectedRecipeId && (
                  <div className="grid grid-cols-2 gap-3">
                    <FilmTag label="WB" value={recipe.whiteBalance} />
                    <FilmTag label="DR" value={recipe.dynamicRange} />
                    <FilmTag label="Sharp" value={recipe.sharpness} />
                    <FilmTag label="Color" value={recipe.saturation} />
                  </div>
                )}

                <div className="pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {photos.filter(p => p.recipeId === recipe.id).length} photos
                  </span>
                  <div className="flex items-center gap-2 text-blue-500">
                    <span className="text-[10px] font-black uppercase tracking-widest">Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {selectedRecipeId && selectedRecipe && (() => {
          const wbShift = selectedRecipe.whiteBalanceShift?.split(',').map(s => s.trim()) || [];
          const wbRed = wbShift[0] || '0';
          const wbBlue = wbShift[1] || '0';

          const grainParts = selectedRecipe.grainEffect?.split(',').map(s => s.trim()) || [];
          const grainRoughness = grainParts[0] || 'Off';
          const grainSize = grainParts[1] || 'Off';

          return (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-8 h-full overflow-y-auto pr-4 custom-scrollbar"
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
                    <button 
                      onClick={() => setEditingRecipe(selectedRecipe)}
                      className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]"
                    >
                      <Edit3 className="w-5 h-5 text-slate-400" />
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(selectedRecipe.id)}
                      className="p-4 bg-slate-500/5 hover:bg-red-500/10 rounded-2xl transition-all border border-[var(--border-color)] hover:border-red-500/20"
                    >
                      <Trash2 className="w-5 h-5 text-slate-400 hover:text-red-500" />
                    </button>
                    <button className="p-4 bg-slate-500/5 hover:bg-slate-500/10 rounded-2xl transition-all border border-[var(--border-color)]">
                      <Share2 className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {selectedRecipe.description && (
                  <p className="text-sm text-slate-500 leading-relaxed">{selectedRecipe.description}</p>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'White Balance', value: selectedRecipe.whiteBalance },
                    { label: 'Dynamic Range', value: selectedRecipe.dynamicRange },
                    { label: 'Highlight', value: selectedRecipe.highlightTone },
                    { label: 'Shadow', value: selectedRecipe.shadowTone },
                    { label: 'Color', value: selectedRecipe.saturation },
                    { label: 'Sharpness', value: selectedRecipe.sharpness },
                    { label: 'Noise Reduction', value: selectedRecipe.noiseReduction },
                    { label: 'Clarity', value: selectedRecipe.clarity },
                    { label: 'Grain Roughness', value: grainRoughness },
                    { label: 'Grain Size', value: grainSize },
                    { label: 'Color Chrome', value: selectedRecipe.colorChromeEffect },
                    { label: 'FX Blue', value: selectedRecipe.colorChromeEffectBlue },
                    { label: 'WB Red', value: wbRed },
                    { label: 'WB Blue', value: wbBlue },
                  ].map(stat => (
                    <FilmSettingCard key={stat.label} label={stat.label} value={stat.value} />
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
                        <img src={photo.thumbnailUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white" />
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
          );
        })()}
      </div>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
                <h2 className="text-2xl font-black tracking-tight">New Recipe</h2>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              {renderRecipeForm(newRecipe, setNewRecipe, handleCreate, 'Create Recipe')}
              <div className="p-8 border-t border-[var(--border-color)] flex-shrink-0">
                <button 
                  onClick={handleCreate}
                  disabled={!newRecipe.name}
                  className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Recipe
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
                <h2 className="text-2xl font-black tracking-tight">Edit Recipe</h2>
                <button onClick={() => setEditingRecipe(null)} className="p-2 hover:bg-slate-500/10 rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              {renderRecipeForm(editingRecipe, setEditingRecipe, handleUpdate, 'Save Changes')}
              <div className="p-8 border-t border-[var(--border-color)] flex-shrink-0">
                <button 
                  onClick={handleUpdate}
                  disabled={!editingRecipe.name}
                  className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <ConfirmModal 
            title="Delete Recipe"
            message="Are you sure you want to delete this recipe? This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={() => handleDelete(showDeleteConfirm)}
            onCancel={() => setShowDeleteConfirm(null)}
            variant="danger"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Slider({ 
  value, 
  onChange, 
  min = -4, 
  max = 4, 
  step = 1,
  label
}: { 
  value: number, 
  onChange: (val: number) => void, 
  min?: number, 
  max?: number, 
  step?: number,
  label?: string
}) {
  return (
    <div className="space-y-4 p-6 bg-slate-500/5 rounded-2xl border border-[var(--border-color)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <span className={cn(
          "text-sm font-black px-3 py-1 rounded-lg",
          value > 0 ? "bg-blue-500/10 text-blue-500" : value < 0 ? "bg-red-500/10 text-red-500" : "bg-slate-500/10 text-slate-500"
        )}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-500/10 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
        <span>{min}</span>
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Switch({ 
  checked, 
  onChange, 
  label 
}: { 
  checked: boolean, 
  onChange: (val: boolean) => void, 
  label: string 
}) {
  return (
    <div className="flex items-center justify-between p-6 bg-slate-500/5 rounded-2xl border border-[var(--border-color)]">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none",
          checked ? "bg-blue-500" : "bg-slate-500/20"
        )}
      >
        <motion.div
          animate={{ x: checked ? 26 : 4 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}
