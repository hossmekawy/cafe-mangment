import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiFolder, FiChevronRight, FiChevronDown, FiImage, FiSearch, FiSave, FiX } from 'react-icons/fi';
import { inventoryApi } from '../../api/inventoryApi';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        name_ar: '',
        description: '',
        parent: '',
        is_active: true,
        order: 0
    });
    
    // UI states
    const [expandedNodeIds, setExpandedNodeIds] = useState(new Set());
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const { data } = await inventoryApi.getCategories();
            // Data is plain flat array, we will build tree dynamically
            setCategories(data);
        } catch (error) {
            toast.error("Failed to fetch categories");
        } finally {
            setLoading(false);
        }
    };

    const buildCategoryTree = (cats) => {
        const catMap = {};
        const roots = [];
        cats.forEach(c => catMap[c.id] = { ...c, children: [] });
        cats.forEach(c => {
            if (c.parent) {
                if (catMap[c.parent]) catMap[c.parent].children.push(catMap[c.id]);
            } else {
                roots.push(catMap[c.id]);
            }
        });
        
        // Sort by order then name
        const sortNodes = (nodes) => {
            nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
            nodes.forEach(n => sortNodes(n.children));
        };
        sortNodes(roots);
        return roots;
    };

    const filteredTree = useMemo(() => {
        if (!searchQuery) return buildCategoryTree(categories);
        const lowerQ = searchQuery.toLowerCase();
        // If searching, just flatten and return matches for now to keep it simple
        const matches = categories.filter(c => c.name.toLowerCase().includes(lowerQ) || (c.name_ar && c.name_ar.toLowerCase().includes(lowerQ)));
        // Return them as a flat list but formatted like roots
        return matches.map(m => ({ ...m, children: [] }));
    }, [categories, searchQuery]);

    const toggleNode = (id, e) => {
        e.stopPropagation();
        setExpandedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleOpenModal = (category = null, parentId = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                name_ar: category.name_ar || '',
                description: category.description || '',
                parent: category.parent || '',
                is_active: category.is_active,
                order: category.order || 0
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                name_ar: '',
                description: '',
                parent: parentId || '',
                is_active: true,
                order: 0
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const toastId = toast.loading(editingCategory ? "Updating category..." : "Creating category...");
        
        // Remove empty strings for parent so it sends null
        const submitData = { ...formData };
        if (!submitData.parent) submitData.parent = null;

        try {
            if (editingCategory) {
                await inventoryApi.updateCategory(editingCategory.id, submitData);
                toast.success("Category updated", { id: toastId });
            } else {
                await inventoryApi.createCategory(submitData);
                toast.success("Category created", { id: toastId });
            }
            fetchCategories();
            setIsModalOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.detail || "Action failed", { id: toastId });
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        const toastId = toast.loading("Deleting category...");
        try {
            await inventoryApi.deleteCategory(categoryToDelete.id);
            toast.success("Category deleted", { id: toastId });
            fetchCategories();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Failed to delete. It might be in use.", { id: toastId });
        } finally {
            setDeleteModalOpen(false);
            setCategoryToDelete(null);
        }
    };

    const CategoryNode = ({ node, level = 0 }) => {
        const isExpanded = expandedNodeIds.has(node.id) || !!searchQuery;
        const hasChildren = node.children && node.children.length > 0;
        
        return (
            <div className="flex flex-col">
                <div 
                    className={`
                        flex items-center justify-between p-3 border-b border-white/5 hover:bg-white/5 transition-colors group
                        ${level === 0 ? 'bg-white/5 font-medium' : ''}
                    `}
                    style={{ paddingLeft: `${(level * 24) + 12}px` }}
                >
                    <div className="flex items-center space-x-3">
                        {hasChildren ? (
                            <button onClick={(e) => toggleNode(node.id, e)} className="p-1 text-textMuted hover:text-white rounded">
                                {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                            </button>
                        ) : (
                            <div className="w-6" /> // spacer
                        )}
                        
                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center shrink-0">
                            {node.image ? (
                                <img src={node.image} alt="cat" className="w-full h-full object-cover rounded" />
                            ) : (
                                <FiFolder className="text-textMuted" />
                            )}
                        </div>
                        
                        <div>
                            <div className="flex items-center space-x-2">
                                <span className={!node.is_active ? 'text-textMuted line-through' : 'text-white'}>{node.name}</span>
                                {node.name_ar && <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-textMuted">{node.name_ar}</span>}
                            </div>
                            <div className="text-xs text-textMuted">
                                {node.children.length} subcategories
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleOpenModal(null, node.id)}
                            className="p-1.5 text-xs bg-primary/20 text-primary hover:bg-primary hover:text-white rounded transition-colors flex items-center space-x-1"
                            title="Add Subcategory"
                        >
                            <FiPlus /> <span>Sub</span>
                        </button>
                        <button 
                            onClick={() => handleOpenModal(node)}
                            className="p-1.5 text-textMuted hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
                        >
                            <FiEdit2 />
                        </button>
                        <button 
                            onClick={() => { setCategoryToDelete(node); setDeleteModalOpen(true); }}
                            className="p-1.5 text-red-400 hover:text-white bg-red-400/10 hover:bg-red-500 rounded transition-colors"
                        >
                            <FiTrash2 />
                        </button>
                    </div>
                </div>
                
                {isExpanded && hasChildren && (
                    <div className="flex flex-col">
                        {node.children.map(child => (
                            <CategoryNode key={child.id} node={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Get flat options for the Parent dropdown, avoiding circular references by ignoring self and children
    const getDropdownOptions = () => {
        const flatList = [];
        const processNode = (nodes, level = 0) => {
            for (const n of nodes) {
                // If editing, don't show self or descendants to prevent circular
                if (editingCategory && n.id === editingCategory.id) continue;
                
                flatList.push({ id: n.id, name: `${'—'.repeat(level)} ${n.name}` });
                processNode(n.children, level + 1);
            }
        };
        processNode(buildCategoryTree(categories));
        return flatList;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Menu Categories</h1>
                    <p className="text-textMuted text-sm mt-1">Manage infinite levels of categories and subcategories</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="btn btn-primary flex items-center space-x-2"
                >
                    <FiPlus /> <span>New Category</span>
                </button>
            </div>

            <div className="glass-panel p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-full max-w-sm">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input w-full pl-10"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                        {filteredTree.length === 0 ? (
                            <div className="p-8 text-center text-textMuted">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 mb-4">
                                    <FiFolder className="w-6 h-6" />
                                </div>
                                <p>No categories found</p>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {filteredTree.map(rootNode => (
                                    <CategoryNode key={rootNode.id} node={rootNode} level={0} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                            <h2 className="text-xl font-semibold text-white">
                                {editingCategory ? 'Edit Category' : 'New Category'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-textMuted hover:text-white">
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="categoryForm" onSubmit={handleSubmit} className="space-y-4">
                                
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-2">Parent Category</label>
                                    <select 
                                        value={formData.parent}
                                        onChange={(e) => setFormData({...formData, parent: e.target.value})}
                                        className="input w-full"
                                    >
                                        <option value="">None (Top Level)</option>
                                        {getDropdownOptions().map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-textMuted mb-2">Name (English) *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            className="input w-full"
                                            placeholder="e.g. Hot Drinks"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMuted mb-2">Name (Arabic)</label>
                                        <input 
                                            type="text" 
                                            value={formData.name_ar}
                                            onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                                            className="input w-full text-right"
                                            dir="rtl"
                                            placeholder="مشروبات ساخنة"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-2">Description</label>
                                    <textarea 
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        className="input w-full h-20 resize-none"
                                        placeholder="Optional description..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-textMuted mb-2">Display Order</label>
                                        <input 
                                            type="number" 
                                            value={formData.order}
                                            onChange={(e) => setFormData({...formData, order: parseInt(e.target.value) || 0})}
                                            className="input w-full"
                                        />
                                    </div>
                                    <div className="flex items-center mt-8">
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                                                className="w-5 h-5 rounded border-white/20 bg-black/20 text-primary focus:ring-primary focus:ring-offset-gray-900"
                                            />
                                            <span className="text-textMain font-medium">Active</span>
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-6 border-t border-white/10 flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="btn hover:bg-white/5">
                                Cancel
                            </button>
                            <button type="submit" form="categoryForm" className="btn btn-primary flex items-center space-x-2">
                                <FiSave /> <span>Save</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal 
                isOpen={deleteModalOpen}
                title="Delete Category"
                message={`Are you sure you want to delete ${categoryToDelete?.name}? Subcategories and linked products might be affected.`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteModalOpen(false)}
                confirmText="Delete Category"
                isDestructive={true}
            />
        </div>
    );
}
