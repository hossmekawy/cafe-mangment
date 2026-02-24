import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import Select from 'react-select';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEye, FiSettings, FiSearch, FiLayers, FiUploadCloud, FiDownload, FiX, FiCheck, FiArrowLeft } from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import DataTable from '../../components/DataTable';
import { inventoryApi } from '../../api/inventoryApi';
import { posApi } from '../../api/posApi';
import useSettingsStore from '../../store/settingsStore';
import ConfirmModal from '../../components/ConfirmModal';

const recipeSchema = yup.object().shape({
    product: yup.string().required('Product is required'),
    yield_quantity: yup.number().positive('Must be positive').required('Yield quantity is required'),
    preparation_time: yup.number().min(0, 'Cannot be negative').required('Prep time is required'),
    notes: yup.string().nullable(),
    ingredients: yup.array().of(
        yup.object().shape({
            raw_material: yup.string().required('Ingredient is required'),
            quantity: yup.number().min(0.001, 'Quantity must be > 0').required('Required'),
            unit: yup.number().required('Unit is required')
        })
    ).min(1, 'At least one ingredient is required')
});

const selectStyles = {
    control: (base, state) => ({
        ...base,
        background: 'rgba(255, 255, 255, 0.05)',
        borderColor: state.isFocused ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
        color: '#fff',
        minHeight: '38px',
        boxShadow: 'none',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.875rem',
        '&:hover': { borderColor: 'rgba(255, 255, 255, 0.2)' }
    }),
    menu: (base) => ({
        ...base,
        background: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '0.5rem',
        zIndex: 100
    }),
    option: (base, state) => ({
        ...base,
        background: state.isSelected ? 'rgba(59, 130, 246, 0.3)' : state.isFocused ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        color: state.isSelected ? '#fff' : '#cbd5e1',
        cursor: 'pointer',
        fontSize: '0.875rem',
        '&:active': { background: 'rgba(59, 130, 246, 0.4)' }
    }),
    singleValue: (base) => ({ ...base, color: '#fff' }),
    input: (base) => ({ ...base, color: '#fff' })
};

const Recipes = () => {
    const [recipes, setRecipes] = useState([]);
    const [products, setProducts] = useState([]);
    const [variations, setVariations] = useState([]);
    const [modifiers, setModifiers] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [units, setUnits] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // UI State
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [materialSearch, setMaterialSearch] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [recipeToDelete, setRecipeToDelete] = useState(null);
    const [viewRecipe, setViewRecipe] = useState(null);
    const [importModalOpen, setImportModalOpen] = useState(false);

    const { settings } = useSettingsStore();

    const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
        resolver: yupResolver(recipeSchema),
        defaultValues: { ingredients: [], yield_quantity: 1, preparation_time: 5 }
    });

    const { fields, append, remove, move } = useFieldArray({
        control,
        name: "ingredients"
    });

    const watchIngredients = watch("ingredients");

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [recipesRes, prodRes, varRes, modRes, matRes, unitsRes] = await Promise.all([
                inventoryApi.getRecipes(),
                inventoryApi.getProducts(),
                inventoryApi.getVariations(),
                posApi.getModifiers(),
                inventoryApi.getMaterials(),
                inventoryApi.getUnits()
            ]);
            setRecipes(recipesRes.data);
            setProducts(prodRes.data);
            setVariations(varRes.data);
            setModifiers(modRes.data);
            setMaterials(matRes.data);
            setUnits(unitsRes.data);
        } catch (error) {
            toast.error('Failed to load recipe data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredMaterials = useMemo(() => {
        if (!materialSearch) return materials;
        return materials.filter(m => m.name.toLowerCase().includes(materialSearch.toLowerCase()));
    }, [materials, materialSearch]);

    // Drag and Drop Handlers
    const onDragEnd = (result) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;

        // Reordering within the recipe ingredients list
        if (source.droppableId === 'recipe-ingredients' && destination.droppableId === 'recipe-ingredients') {
            move(source.index, destination.index);
            return;
        }

        // Dragging a new material from the sidebar to the recipe
        if (source.droppableId === 'sidebar-materials' && destination.droppableId === 'recipe-ingredients') {
            const material = materials.find(m => m.id === draggableId);
            if (material) {
                // Prevent duplicate raw_materials, just highlight if exists, or allow multiple (we allow multiple for complex recipes but usually it's one)
                // We'll append it
                append({
                    raw_material: material.id,
                    quantity: 1,
                    unit: material.unit, // default to its base unit
                    _tempName: material.name, // Just for UI display before save
                    _tempCost: material.cost_per_unit
                });
            }
        }
    };

    const openBuilder = (recipe = null) => {
        setEditingRecipe(recipe);
        if (recipe) {
            // Need to map the existing ingredients into the form format
            reset({
                product: recipe.modifier ? recipe.modifier : (recipe.variation ? recipe.variation : recipe.product),
                yield_quantity: recipe.yield_quantity,
                preparation_time: recipe.preparation_time,
                notes: recipe.notes || '',
                ingredients: recipe.ingredients.map(ing => ({
                    raw_material: ing.raw_material,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    _tempName: ing.raw_material_name,
                    _tempCost: ing.cost // Pre-calculated from backend
                }))
            });
        } else {
            reset({
                product: '',
                yield_quantity: 1,
                preparation_time: 5,
                notes: '',
                ingredients: []
            });
        }
        setIsBuilderOpen(true);
    };

    const onSubmit = async (data) => {
        try {
            // Clean up temporary UI fields
            const payload = {
                ...data,
                ingredients: data.ingredients.map(ing => ({
                    raw_material: ing.raw_material,
                    quantity: parseFloat(ing.quantity),
                    unit: ing.unit
                }))
            };

            if (editingRecipe) {
                await inventoryApi.updateRecipe(editingRecipe.id, payload);
                toast.success('Recipe updated successfully');
            } else {
                await inventoryApi.createRecipe(payload);
                toast.success('Recipe created successfully');
            }
            setIsBuilderOpen(false);
            fetchData();
        } catch (error) {
            console.error("Recipe Save Error:", error.response?.data || error.message);
            const data = error.response?.data;
            const errMsg = data?.product?.[0] || 
                           data?.non_field_errors?.[0] || 
                           data?.detail || 
                           error.message ||
                           'Failed to save recipe';
            toast.error(errMsg);
        }
    };

    const confirmDelete = async () => {
        try {
            await inventoryApi.deleteRecipe(recipeToDelete.id);
            toast.success('Recipe deleted successfully');
            setDeleteConfirmOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to delete recipe');
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Target Product',
            accessorKey: 'target_name', // Updated to use the new backend serializer field
            cell: info => <span className="font-bold text-white">{info.getValue() || 'Unknown Product'}</span>
        },
        {
            header: 'Prep Time',
            accessorKey: 'preparation_time',
            cell: info => <span className="text-textMuted">{info.getValue()} mins</span>
        },
        {
            header: 'Target Yield',
            accessorKey: 'yield_quantity',
            cell: info => <span className="font-mono text-accent">{parseFloat(info.getValue()).toFixed(2)} units</span>
        },
        {
            header: 'Item Cost Structure',
            accessorKey: 'total_cost',
            cell: info => (
                <div className="flex flex-col">
                    <span className="font-mono text-red-400 font-bold">{settings?.currency || '$'}{parseFloat(info.getValue()).toFixed(2)} total</span>
                    <span className="text-xs text-textMuted mt-0.5">
                        {settings?.currency || '$'}{(parseFloat(info.getValue()) / parseFloat(info.row.original.yield_quantity)).toFixed(2)} per yield unit
                    </span>
                </div>
            )
        },
        {
            header: 'Actions',
            id: 'actions',
            cell: info => (
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setViewRecipe(info.row.original)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                        title="View Recipe Formula"
                    >
                        <FiEye className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => openBuilder(info.row.original)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                        title="Edit Recipe"
                    >
                        <FiSettings className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => {
                            setRecipeToDelete(info.row.original);
                            setDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                    >
                        <FiTrash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], [settings]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                     <h1 className="text-2xl font-bold text-white">Recipe Engineering</h1>
                     <p className="text-sm text-textMuted mt-1">Design formulas linking Raw Materials to Menu Items to auto-deduct stock upon sales.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={() => setImportModalOpen(true)}
                        className="bg-[#1e293b] hover:bg-[#2dd4bf]/20 text-white border border-white/10 hover:border-[#2dd4bf]/50 px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2"
                    >
                        <FiUploadCloud className="w-5 h-5 text-[#2dd4bf]" />
                        <span>Bulk Import</span>
                    </button>
                    <button 
                        onClick={() => openBuilder()}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
                    >
                        <FiLayers className="w-5 h-5" />
                        <span>Launch Recipe Builder</span>
                    </button>
                </div>
            </div>

            <DataTable 
                columns={columns} 
                data={recipes} 
                isLoading={isLoading}
                searchPlaceholder="Search recipes by product..."
            />

            {/* Drag & Drop Recipe Builder Modal */}
            {isBuilderOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsBuilderOpen(false)}></div>
                    <div className="relative bg-[#1e293b] w-full max-w-6xl h-[85vh] rounded-2xl flex flex-col shadow-2xl border border-white/10 overflow-hidden">
                        
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#0f172a]">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-wide">
                                    {editingRecipe ? 'Edit Recipe Formula' : 'Recipe Builder Studio'}
                                </h2>
                                <p className="text-xs text-primary font-medium mt-1 uppercase tracking-wider">Drag & Drop Required</p>
                            </div>
                            <div className="flex space-x-3">
                                <button type="button" onClick={() => setIsBuilderOpen(false)} className="px-5 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors font-medium">
                                    Discard Changes
                                </button>
                                <button onClick={handleSubmit(onSubmit)} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors font-bold shadow-lg shadow-primary/20">
                                    {editingRecipe ? 'Save Formula' : 'Initialize Recipe'}
                                </button>
                            </div>
                        </div>

                        {/* Builder Body */}
                        <div className="flex-1 flex overflow-hidden">
                            <DragDropContext onDragEnd={onDragEnd}>
                                
                                {/* Left Sidebar: Materials Palette */}
                                <div className="w-80 border-r border-white/10 bg-[#162032] flex flex-col">
                                    <div className="p-4 border-b border-white/10">
                                        <div className="relative">
                                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-textMuted" />
                                            <input 
                                                type="text" 
                                                placeholder="Search materials..." 
                                                value={materialSearch}
                                                onChange={(e) => setMaterialSearch(e.target.value)}
                                                className="w-full bg-[#0f172a] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                            />
                                        </div>
                                    </div>
                                    
                                    <Droppable droppableId="sidebar-materials" isDropDisabled={true}>
                                        {(provided) => (
                                            <div 
                                                ref={provided.innerRef} 
                                                {...provided.droppableProps}
                                                className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar"
                                            >
                                                {filteredMaterials.map((mat, index) => (
                                                    <Draggable key={mat.id} draggableId={mat.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`
                                                                    p-3 rounded-lg border border-white/10 flex items-center space-x-3 transition-colors user-select-none
                                                                    ${snapshot.isDragging ? 'bg-primary/20 border-primary shadow-xl shadow-primary/20 z-50' : 'bg-[#1e293b] hover:border-white/20'}
                                                                `}
                                                            >
                                                                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0">
                                                                    <MdDragIndicator className="text-textMuted" />
                                                                </div>
                                                                <div className="overflow-hidden">
                                                                    <p className="text-sm font-semibold text-white truncate text-wrap leading-tight">
                                                                        {mat.item_type === 'subrecipe' && <span className="text-[#2dd4bf] mr-1">[Prep]</span>}
                                                                        {mat.name}
                                                                    </p>
                                                                    <p className="text-xs text-textMuted mt-0.5 truncate">Base: {mat.unit_abbreviation} • {settings?.currency || '$'}{mat.cost_per_unit}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>

                                {/* Right Area: Recipe Canvas */}
                                <div className="flex-1 flex flex-col overflow-y-auto bg-[#0f172a]">
                                    
                                    {/* Recipe Settings Header */}
                                    <div className="p-6 border-b border-white/10 bg-[#1e293b] grid grid-cols-3 gap-6">
                                        <div className="col-span-1">
                                            <label className="block text-sm font-medium text-textMuted mb-1.5">Target Product (Menu Item) *</label>
                                            <Controller
                                                name="product"
                                                control={control}
                                                render={({ field: { onChange, value, ref } }) => {
                                                    // Map base products
                                                    const productOptions = products
                                                        .filter(p => p.availability_status === 'available')
                                                        .map(p => ({ value: p.id, label: p.name, type: 'product' }));
                                                        
                                                    // Map variations (sizes)
                                                    const variationOptions = variations
                                                        .filter(v => v.is_active)
                                                        .map(v => {
                                                            const baseProduct = products.find(p => p.id === v.product);
                                                            return { 
                                                                value: v.id, 
                                                                label: `${baseProduct ? baseProduct.name : 'Unknown'} - ${v.size_name}`,
                                                                type: 'variation' 
                                                            };
                                                        });
                                                        
                                                    // Map Modifiers
                                                    const modifierOptions = modifiers
                                                        .filter(m => m.is_active)
                                                        .map(m => ({
                                                            value: m.id,
                                                            label: `Modifier: ${m.name}`,
                                                            type: 'modifier'
                                                        }));
                                                        
                                                    const combinedOptions = [
                                                        { label: 'Base Products', options: productOptions },
                                                        { label: 'Variations & Sizes', options: variationOptions },
                                                        { label: 'Add-ons & Modifiers', options: modifierOptions }
                                                    ];
                                                    
                                                    // Find selected value from grouped options
                                                    let selectedOption = '';
                                                    for (const group of combinedOptions) {
                                                        const match = group.options.find(opt => opt.value === value);
                                                        if (match) {
                                                            selectedOption = match;
                                                            break;
                                                        }
                                                    }

                                                    return (
                                                        <Select
                                                            ref={ref}
                                                            options={combinedOptions}
                                                            styles={selectStyles}
                                                            placeholder="Select target..."
                                                            value={selectedOption}
                                                            onChange={val => onChange(val ? val.value : '')}
                                                            isClearable
                                                        />
                                                    );
                                                }}
                                            />
                                            {errors.product && <span className="text-red-400 text-xs mt-1 block">{errors.product.message}</span>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1.5">Yield Quantity *</label>
                                            <div className="relative">
                                                <input type="number" step="0.01" {...register('yield_quantity')} className="form-input w-full font-mono text-accent" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted text-xs uppercase">Units</span>
                                            </div>
                                            {errors.yield_quantity && <span className="text-red-400 text-xs mt-1 block">{errors.yield_quantity.message}</span>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1.5">Prep Time (Avg) *</label>
                                            <div className="relative">
                                                <input type="number" {...register('preparation_time')} className="form-input w-full font-mono text-accent" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted text-xs uppercase">Mins</span>
                                            </div>
                                            {errors.preparation_time && <span className="text-red-400 text-xs mt-1 block">{errors.preparation_time.message}</span>}
                                        </div>
                                    </div>

                                    {/* Drop Canvas */}
                                    <div className="flex-1 p-6 flex flex-col">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold text-white flex items-center"><FiLayers className="mr-2 text-primary"/> Formula Ingredients</h3>
                                            <span className="text-xs font-medium px-2.5 py-1 bg-primary/20 text-primary rounded-full border border-primary/20">
                                                {fields.length} Components
                                            </span>
                                        </div>

                                        <Droppable droppableId="recipe-ingredients">
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={`
                                                        flex-1 rounded-xl border-2 border-dashed transition-all p-4 overflow-y-auto min-h-[300px]
                                                        ${snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-white/10 bg-white/5'}
                                                        ${errors.ingredients?.root ? 'border-red-500/50 bg-red-500/5' : ''}
                                                    `}
                                                >
                                                    {fields.length === 0 && !snapshot.isDraggingOver && (
                                                        <div className="h-full flex flex-col items-center justify-center text-textMuted opacity-60">
                                                            <FiPlus className="w-12 h-12 mb-3 text-white/20" />
                                                            <p className="font-medium text-lg">Empty Formula</p>
                                                            <p className="text-sm">Drag raw materials from the sidebar here to formulate.</p>
                                                        </div>
                                                    )}

                                                    {fields.map((item, index) => {
                                                        const materialId = watchIngredients[index]?.raw_material;
                                                        const matData = materials.find(m => m.id === materialId) || {};
                                                        const displayName = item._tempName || matData.name || 'Unknown Material';

                                                        return (
                                                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        className={`
                                                                            mb-3 p-4 rounded-xl border flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4
                                                                            ${snapshot.isDragging ? 'bg-[#1e293b] border-primary shadow-2xl' : 'bg-[#162032] border-white/10 hover:border-white/20'}
                                                                        `}
                                                                    >
                                                                        <div {...provided.dragHandleProps} className="p-2 -ml-2 text-textMuted hover:text-white cursor-grab active:cursor-grabbing">
                                                                            <MdDragIndicator className="w-5 h-5" />
                                                                        </div>
                                                                        
                                                                        <div className="w-full md:w-1/3">
                                                                            <p className="font-bold text-white tracking-wide">{displayName}</p>
                                                                            <p className="text-xs text-textMuted font-mono mt-1">ID: {materialId.substring(0,8)}... </p>
                                                                            <input type="hidden" {...register(`ingredients.${index}.raw_material`)} />
                                                                        </div>

                                                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                                                            <div>
                                                                                <label className="block text-[10px] uppercase tracking-wider text-textMuted mb-1 font-semibold">Consumption Qty</label>
                                                                                <input 
                                                                                    type="number" 
                                                                                    step="0.0001" 
                                                                                    {...register(`ingredients.${index}.quantity`)} 
                                                                                    className="form-input w-full font-mono text-accent text-sm py-1.5" 
                                                                                />
                                                                                {errors.ingredients?.[index]?.quantity && <span className="text-red-400 text-[10px]">{errors.ingredients[index].quantity.message}</span>}
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[10px] uppercase tracking-wider text-textMuted mb-1 font-semibold">Unit of Measure</label>
                                                                                <Controller
                                                                                    name={`ingredients.${index}.unit`}
                                                                                    control={control}
                                                                                    render={({ field }) => (
                                                                                        <Select
                                                                                            {...field}
                                                                                            options={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
                                                                                            styles={{...selectStyles, control: (b, s) => ({...selectStyles.control(b,s), minHeight: '34px'})}}
                                                                                            value={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })).find(u => u.value === field.value)}
                                                                                            onChange={val => field.onChange(val.value)}
                                                                                        />
                                                                                    )}
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => remove(index)}
                                                                            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors self-end md:self-auto"
                                                                        >
                                                                            <FiTrash2 />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        )
                                                    })}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                        {errors.ingredients?.root && <span className="text-red-400 text-sm mt-3 font-medium bg-red-500/10 p-3 rounded-lg block border border-red-500/20">{errors.ingredients.root.message}</span>}
                                        
                                        <div className="mt-4">
                                             <label className="block text-sm font-medium text-textMuted mb-1.5">Preparation Instructions / Notes (Optional)</label>
                                             <textarea {...register('notes')} className="form-input w-full min-h-[60px] text-sm" placeholder="e.g. Blend until smooth. Add ice last."></textarea>
                                        </div>
                                    </div>
                                </div>
                            </DragDropContext>
                        </div>
                    </div>
                </div>
            )}

            {/* View Recipe Modal (Read-Only) */}
            {viewRecipe && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewRecipe(null)}></div>
                    <div className="relative glass-panel w-full max-w-2xl p-0 overflow-hidden">
                        <div className="bg-[#1e293b] p-6 border-b border-white/10">
                            <h2 className="text-2xl font-bold text-white">{viewRecipe.product_name} Recipe</h2>
                            <div className="flex space-x-6 mt-3 text-sm">
                                <span className="text-primary font-mono bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Yield: {parseFloat(viewRecipe.yield_quantity)}</span>
                                <span className="text-textMuted bg-white/5 px-3 py-1 rounded-full border border-white/10">Prep: {viewRecipe.preparation_time} mins</span>
                                <span className="text-red-400 font-mono font-bold bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">Cost: {settings?.currency}{parseFloat(viewRecipe.total_cost).toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="p-6 bg-[#0f172a] max-h-[60vh] overflow-y-auto">
                            <h3 className="text-sm uppercase tracking-widest text-textMuted font-bold mb-4">Required Ingredients</h3>
                            <div className="space-y-2">
                                {viewRecipe.ingredients.map((ing, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-lg">
                                        <div>
                                            <p className="font-bold text-white">{ing.raw_material_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-accent text-lg">{parseFloat(ing.quantity)} <span className="text-sm text-textMuted">{ing.unit_abbreviation}</span></p>
                                            <p className="text-xs text-red-400 font-mono">Cost: {settings?.currency}{parseFloat(ing.cost).toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {viewRecipe.notes && (
                                <div className="mt-6 p-4 bg-[#1e293b] rounded-lg border border-white/10">
                                    <h3 className="text-sm uppercase tracking-widest text-textMuted font-bold mb-2">Instructions</h3>
                                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{viewRecipe.notes}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-[#1e293b] border-t border-white/10 flex justify-end">
                            <button onClick={() => setViewRecipe(null)} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={deleteConfirmOpen}
                title="Delete Recipe Formula"
                message={`Are you sure you want to delete the recipe for "${recipeToDelete?.product_name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
                confirmText="Delete Recipe"
                isDestructive={true}
            />
            {/* Bulk Import Modal */}
            <ImportRecipesModal 
                isOpen={importModalOpen} 
                onClose={() => setImportModalOpen(false)} 
                onSuccess={() => { setImportModalOpen(false); fetchData(); }} 
            />
        </div>
    );
};

// -------------------------------------------------------------
// BULK IMPORT MODAL (Two-Step process)
// -------------------------------------------------------------
const ImportRecipesModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState([]);

    if (!isOpen) return null;

    const resetModal = () => {
        setStep(1);
        setFile(null);
        setPreviewData([]);
        onClose();
    };

    const handleDownloadTemplate = async () => {
        try {
            const toastId = toast.loading("Downloading template...");
            const response = await inventoryApi.exportRecipesTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'recipes_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Template downloaded", { id: toastId });
        } catch (error) {
            toast.error("Failed to download template");
        }
    };

    const handlePreview = async () => {
        if (!file) return toast.error("Please select an Excel file first");
        
        const formData = new FormData();
        formData.append('file', file);
        
        setIsProcessing(true);
        const toastId = toast.loading("Parsing Excel file...");
        
        try {
            const response = await inventoryApi.previewBulkRecipes(formData);
            if (response.data.success && response.data.data.length > 0) {
                toast.success("File parsed! Please review the data.", { id: toastId });
                setPreviewData(response.data.data);
                setStep(2);
            } else {
                toast.error("No valid data found in the file", { id: toastId });
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Failed to parse the file.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmImport = async () => {
        setIsProcessing(true);
        const toastId = toast.loading("Importing recipes...");
        try {
            const response = await inventoryApi.confirmBulkRecipes(previewData);
            if (response.data.success) {
                toast.success(response.data.message, { id: toastId });
                if (response.data.errors?.length > 0) {
                    toast.error(`Some rows failed: ${response.data.errors.length} errors. Check console.`, { duration: 5000 });
                    console.warn("Import Errors:", response.data.errors);
                }
                onSuccess();
                resetModal();
            } else {
                toast.error(response.data.detail || "Import failed", { id: toastId });
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Import failed during saving.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCellChange = (rowIndex, field, value) => {
        const newData = [...previewData];
        newData[rowIndex][field] = value;
        setPreviewData(newData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
            <div className={`bg-[#1e293b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${step === 2 ? 'w-full max-w-6xl' : 'w-full max-w-md'}`}>
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a] shrink-0">
                    <h3 className="text-xl font-black text-white flex items-center space-x-2">
                        <FiUploadCloud className="text-[#2dd4bf]" /> 
                        <span>{step === 1 ? 'Bulk Import Recipes' : 'Review & Edit Recipe Data'}</span>
                    </h3>
                    <button onClick={resetModal} className="text-textMuted hover:text-white bg-white/5 p-2 rounded-lg transition-colors">
                        <FiX />
                    </button>
                </div>
                
                {step === 1 ? (
                    <>
                        <div className="p-6 space-y-6">
                            <div className="bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-white font-medium mb-3">1. Download the Excel template</p>
                                <button 
                                    onClick={handleDownloadTemplate}
                                    className="bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/30 text-[#2dd4bf] border border-[#2dd4bf]/30 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 transition-colors"
                                >
                                    <FiDownload /> <span>Download Template.xlsx</span>
                                </button>
                                <p className="text-xs text-textMuted mt-3">Fill in your recipe details exactly as structured.</p>
                            </div>

                            <div className="border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-white font-medium mb-3">2. Upload filled Excel file</p>
                                <div className="w-full relative">
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls" 
                                        onChange={(e) => setFile(e.target.files[0])}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={`w-full py-4 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center ${file ? 'border-green-500/50 bg-green-500/10' : 'border-white/20 bg-white/5 hover:border-[#2dd4bf]/50'}`}>
                                        <FiUploadCloud className={`w-6 h-6 mb-2 ${file ? 'text-green-400' : 'text-textMuted'}`} />
                                        <span className={`text-sm font-bold ${file ? 'text-green-400' : 'text-textMuted'}`}>
                                            {file ? file.name : 'Click to browse or drag file here'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-white/10 bg-[#0f172a]">
                            <button 
                                onClick={handlePreview}
                                disabled={!file || isProcessing}
                                className="w-full bg-[#2dd4bf] hover:bg-[#2dd4bf]/90 disabled:opacity-50 text-[#0f172a] font-black py-3 rounded-xl shadow-[0_0_15px_rgba(45,212,191,0.3)] transition-all flex justify-center items-center space-x-2"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0f172a]"></div>
                                ) : (
                                    <>
                                        <span>Preview Data</span> <FiArrowLeft className="rotate-180" />
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-white/10 text-textMuted">
                                        <th className="pb-3 px-2 font-medium">Target Type</th>
                                        <th className="pb-3 px-2 font-medium">Target ID</th>
                                        <th className="pb-3 px-2 font-medium">Yield</th>
                                        <th className="pb-3 px-2 font-medium">Ingredient ID</th>
                                        <th className="pb-3 px-2 font-medium">Quantity</th>
                                        <th className="pb-3 px-2 font-medium">Unit ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-2">
                                                <input type="text" value={row.target_type} onChange={(e) => handleCellChange(idx, 'target_type', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.target_id} onChange={(e) => handleCellChange(idx, 'target_id', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.yield_quantity} onChange={(e) => handleCellChange(idx, 'yield_quantity', e.target.value)} className="input py-1 px-2 w-20 text-sm focus:ring-1 focus:ring-primary" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.ingredient_id} onChange={(e) => handleCellChange(idx, 'ingredient_id', e.target.value)} className="input py-1 px-2 w-24 text-sm focus:ring-1 focus:ring-primary" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.quantity} onChange={(e) => handleCellChange(idx, 'quantity', e.target.value)} className="input py-1 px-2 w-20 text-sm focus:ring-1 focus:ring-primary" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.unit_id} onChange={(e) => handleCellChange(idx, 'unit_id', e.target.value)} className="input py-1 px-2 w-20 text-sm focus:ring-1 focus:ring-primary text-center" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-between items-center">
                            <button onClick={() => setStep(1)} className="btn hover:bg-white/5 text-textMuted flex items-center space-x-2">
                                <FiArrowLeft /> <span>Back to Upload</span>
                            </button>
                            <button 
                                onClick={handleConfirmImport}
                                disabled={isProcessing}
                                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-colors shadow-lg shadow-green-500/20"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        <FiCheck /> <span>Confirm & Import {previewData.length} Recipe Ingredients</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Recipes;
