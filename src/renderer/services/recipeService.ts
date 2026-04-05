import { Recipe } from '../types';
import '../types/electronAPI';

const LOCAL_RECIPES_KEY = 'fuji-local-recipes';

const mockRecipes: Recipe[] = [
  {
    id: 'r1',
    name: 'Kodak Portra 400',
    description: 'Warm and nostalgic tones for street photography.',
    filmMode: 'Classic Chrome',
    whiteBalance: 'Auto',
    whiteBalanceShift: '0, 0',
    dynamicRange: 'DR400',
    sharpness: '-2',
    saturation: '+1',
    contrast: '-1',
    clarity: '-2',
    shadowTone: '+1',
    highlightTone: '-1',
    noiseReduction: '-4',
    grainEffect: 'Strong, Small',
    colorChromeEffect: 'Off',
    colorChromeEffectBlue: 'Off',
    isFavorite: true,
    ownerId: 'local'
  },
  {
    id: 'r2',
    name: 'Cinestill 800T',
    description: 'Cool shadows and glowing highlights for night shots.',
    filmMode: 'Eterna/Cinema',
    whiteBalance: '3200K',
    whiteBalanceShift: '0, 0',
    dynamicRange: 'DR200',
    sharpness: '0',
    saturation: '+2',
    contrast: '+1',
    clarity: '0',
    shadowTone: '+2',
    highlightTone: '+1',
    noiseReduction: '-2',
    grainEffect: 'Weak, Large',
    colorChromeEffect: 'Off',
    colorChromeEffectBlue: 'Off',
    isFavorite: false,
    ownerId: 'local'
  },
  {
    id: 'r3',
    name: 'Tri-X 400',
    description: 'High contrast black and white with deep blacks.',
    filmMode: 'Acros',
    whiteBalance: 'Auto',
    whiteBalanceShift: '0, 0',
    dynamicRange: 'DR100',
    sharpness: '+1',
    saturation: 'N/A',
    contrast: '+2',
    clarity: '+1',
    shadowTone: '+2',
    highlightTone: '+2',
    noiseReduction: '-4',
    grainEffect: 'Strong, Small',
    colorChromeEffect: 'Off',
    colorChromeEffectBlue: 'Off',
    isFavorite: true,
    ownerId: 'local'
  }
];

const getLocalRecipes = (): Recipe[] => {
  try {
    const stored = localStorage.getItem(LOCAL_RECIPES_KEY);
    return stored ? JSON.parse(stored) : mockRecipes;
  } catch (error) {
    console.error('Failed to get local recipes:', error);
    return mockRecipes;
  }
};

const saveLocalRecipes = (recipes: Recipe[]): void => {
  try {
    localStorage.setItem(LOCAL_RECIPES_KEY, JSON.stringify(recipes));
  } catch (error) {
    console.error('Failed to save local recipes:', error);
  }
};

const convertDbRecipeToRecipe = (dbRecipe: any): Recipe => {
  return {
    id: String(dbRecipe.id),
    name: dbRecipe.name || '',
    description: dbRecipe.description || '',
    filmMode: dbRecipe.film_mode || '',
    whiteBalance: dbRecipe.white_balance || '',
    whiteBalanceShift: dbRecipe.white_balance_shift || '0, 0',
    dynamicRange: dbRecipe.dynamic_range || '',
    sharpness: dbRecipe.sharpness || '0',
    saturation: dbRecipe.saturation || dbRecipe.color || '0',
    contrast: dbRecipe.contrast || '0',
    clarity: dbRecipe.clarity || '0',
    shadowTone: dbRecipe.shadow_tone || '0',
    highlightTone: dbRecipe.highlight_tone || '0',
    noiseReduction: dbRecipe.noise_reduction || '0',
    grainEffect: dbRecipe.grain_effect || 'Off, Off',
    colorChromeEffect: dbRecipe.color_chrome_effect || 'Off',
    colorChromeEffectBlue: dbRecipe.color_chrome_effect_blue || 'Off',
    color: dbRecipe.color || '0',
    isFavorite: dbRecipe.is_favorite || false,
    ownerId: dbRecipe.owner_id || 'local',
    createdAt: dbRecipe.created_at,
    updatedAt: dbRecipe.updated_at
  };
};

const convertRecipeToDbFormat = (recipe: Partial<Recipe>) => {
  return {
    name: recipe.name,
    description: recipe.description || '',
    film_mode: recipe.filmMode || '',
    white_balance: recipe.whiteBalance || '',
    white_balance_shift: recipe.whiteBalanceShift || '0, 0',
    dynamic_range: recipe.dynamicRange || '',
    sharpness: recipe.sharpness || '0',
    saturation: recipe.saturation || recipe.color || '0',
    contrast: recipe.contrast || '0',
    clarity: recipe.clarity || '0',
    shadow_tone: recipe.shadowTone || '0',
    highlight_tone: recipe.highlightTone || '0',
    noise_reduction: recipe.noiseReduction || '0',
    grain_effect: recipe.grainEffect || 'Off, Off',
    color_chrome_effect: recipe.colorChromeEffect || 'Off',
    color_chrome_effect_blue: recipe.colorChromeEffectBlue || 'Off',
    color: recipe.color || '0',
    is_favorite: recipe.isFavorite || false,
    owner_id: recipe.ownerId || 'local'
  };
};

export const recipeService = {
  async loadAllRecipes(): Promise<Recipe[]> {
    try {
      console.log('[recipeService] loadAllRecipes called');
      if (window.electronAPI?.getAllRecipes) {
        console.log('[recipeService] Calling getAllRecipes API');
        const recipes = await window.electronAPI.getAllRecipes();
        console.log('[recipeService] getAllRecipes returned:', recipes);
        return (recipes || []).map(convertDbRecipeToRecipe);
      }
      console.log('[recipeService] No electronAPI.getAllRecipes available, using local');
      return getLocalRecipes();
    } catch (error) {
      console.error('Failed to load recipes:', error);
      return getLocalRecipes();
    }
  },

  async createRecipe(recipe: Partial<Recipe>): Promise<Recipe | null> {
    try {
      console.log('[recipeService] createRecipe called with:', recipe);
      if (window.electronAPI?.createRecipe) {
        const payload = convertRecipeToDbFormat(recipe);
        console.log('[recipeService] Calling createRecipe API with:', payload);
        const result = await window.electronAPI.createRecipe(payload);
        console.log('[recipeService] createRecipe API result:', result);
        if (result && result.id) {
          return convertDbRecipeToRecipe(result);
        }
        return null;
      }
      
      console.log('[recipeService] No electronAPI.createRecipe available, using local');
      const recipes = getLocalRecipes();
      const newRecipe: Recipe = {
        id: `r-${Date.now()}`,
        name: recipe.name || '',
        description: recipe.description || '',
        filmMode: recipe.filmMode || 'Classic Chrome',
        whiteBalance: recipe.whiteBalance || 'Auto',
        whiteBalanceShift: recipe.whiteBalanceShift || '0, 0',
        dynamicRange: recipe.dynamicRange || 'DR100',
        sharpness: recipe.sharpness || '0',
        saturation: recipe.saturation || '0',
        contrast: recipe.contrast || '0',
        clarity: recipe.clarity || '0',
        shadowTone: recipe.shadowTone || '0',
        highlightTone: recipe.highlightTone || '0',
        noiseReduction: recipe.noiseReduction || '0',
        grainEffect: recipe.grainEffect || 'Off, Off',
        colorChromeEffect: recipe.colorChromeEffect || 'Off',
        colorChromeEffectBlue: recipe.colorChromeEffectBlue || 'Off',
        color: recipe.color || '0',
        isFavorite: recipe.isFavorite || false,
        ownerId: recipe.ownerId || 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      recipes.push(newRecipe);
      saveLocalRecipes(recipes);
      return newRecipe;
    } catch (error) {
      console.error('Failed to create recipe:', error);
      return null;
    }
  },

  async updateRecipe(recipe: Recipe): Promise<boolean> {
    try {
      console.log('[recipeService] updateRecipe called with:', recipe);
      if (window.electronAPI?.updateRecipe) {
        const payload = {
          id: Number(recipe.id),
          ...convertRecipeToDbFormat(recipe)
        };
        console.log('[recipeService] Calling updateRecipe API with:', payload);
        await window.electronAPI.updateRecipe(payload);
        return true;
      }
      
      console.log('[recipeService] No electronAPI.updateRecipe available, using local');
      const recipes = getLocalRecipes();
      const index = recipes.findIndex(r => r.id === recipe.id);
      if (index !== -1) {
        recipes[index] = { ...recipe, updatedAt: new Date().toISOString() };
        saveLocalRecipes(recipes);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update recipe:', error);
      return false;
    }
  },

  async deleteRecipe(recipeId: string): Promise<boolean> {
    try {
      console.log('[recipeService] deleteRecipe called with:', recipeId);
      if (window.electronAPI?.deleteRecipe) {
        await window.electronAPI.deleteRecipe(Number(recipeId));
        return true;
      }
      
      console.log('[recipeService] No electronAPI.deleteRecipe available, using local');
      const recipes = getLocalRecipes();
      const filtered = recipes.filter(r => r.id !== recipeId);
      saveLocalRecipes(filtered);
      return true;
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      return false;
    }
  },

  async getRecipeById(recipeId: string): Promise<Recipe | null> {
    try {
      console.log('[recipeService] getRecipeById called with:', recipeId);
      if (window.electronAPI?.getRecipeById) {
        const recipe = await window.electronAPI.getRecipeById(Number(recipeId));
        if (recipe) {
          return convertDbRecipeToRecipe(recipe);
        }
        return null;
      }
      
      const recipes = getLocalRecipes();
      return recipes.find(r => r.id === recipeId) || null;
    } catch (error) {
      console.error('Failed to get recipe by id:', error);
      return null;
    }
  },

  async toggleFavorite(recipeId: string): Promise<boolean> {
    try {
      const recipes = getLocalRecipes();
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe) return false;
      
      const newFavorite = !recipe.isFavorite;
      
      if (window.electronAPI?.updateRecipe) {
        const payload = {
          id: Number(recipeId),
          ...convertRecipeToDbFormat({ ...recipe, isFavorite: newFavorite })
        };
        await window.electronAPI.updateRecipe(payload);
      }
      
      recipe.isFavorite = newFavorite;
      recipe.updatedAt = new Date().toISOString();
      saveLocalRecipes(recipes);
      return true;
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      return false;
    }
  }
};
