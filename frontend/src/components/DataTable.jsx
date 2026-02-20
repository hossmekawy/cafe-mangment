import React, { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiSearch } from 'react-icons/fi';

const DataTable = ({ 
    columns, 
    data, 
    searchPlaceholder = "Search...",
    onRowClick,
    isLoading = false
}) => {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
          <input
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            placeholder={searchPlaceholder}
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-panel overflow-x-auto rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-white/10 bg-white/5">
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    className="p-4 text-sm font-semibold text-textMuted whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center space-x-2">
                        {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                        )}
                        {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                        }[header.column.getIsSorted()] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
                <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-textMuted">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading data...
                    </td>
                </tr>
            ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-textMuted">
                        No results found.
                    </td>
                </tr>
            ) : (
                table.getRowModel().rows.map(row => (
                <tr 
                    key={row.id} 
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.original)}
                >
                    {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-4 text-sm text-textMain">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                    ))}
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between glass-panel px-4 py-3 rounded-lg">
        <div className="text-sm text-textMuted">
            Showing {table.getRowModel().rows.length.toLocaleString()} of{' '}
            {table.getPrePaginationRowModel().rows.length.toLocaleString()} Rows
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <FiChevronsLeft />
          </button>
          <button
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <FiChevronLeft />
          </button>
          
          <span className="text-sm text-textMain px-4">
            Page <span className="font-semibold">{table.getState().pagination.pageIndex + 1}</span> of{' '}
            <span className="font-semibold">{table.getPageCount()}</span>
          </span>

          <button
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <FiChevronRight />
          </button>
          <button
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <FiChevronsRight />
          </button>
        </div>
        
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => {
            table.setPageSize(Number(e.target.value))
          }}
          className="bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize} className="bg-background text-white">
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default DataTable;
