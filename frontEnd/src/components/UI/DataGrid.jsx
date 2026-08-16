import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import styles from "./DataGrid.module.css"

export default function DataGrid({ columns, data, emptyText = "No records found.", globalFilterPlaceholder = "Search..." }) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnVisibility, setColumnVisibility] = useState({})
  const [columnsOpen, setColumnsOpen] = useState(false)

  const safeData = useMemo(() => data || [], [data])

  const table = useReactTable({
    data: safeData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className={styles.gridShell}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={globalFilterPlaceholder}
        />

        <div className={styles.columnMenuWrap}>
          <button type="button" className={styles.columnBtn} onClick={() => setColumnsOpen((open) => !open)}>
            Columns
          </button>
          {columnsOpen && (
            <div className={styles.columnMenu}>
              {table.getAllLeafColumns().map((column) => (
                <label key={column.id} className={styles.columnToggle}>
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  <span>{column.columnDef.meta?.label || column.id}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={styles.headerBtn}
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className={styles.sortMark}>
                          {header.column.getIsSorted() === "asc" ? "Asc" : header.column.getIsSorted() === "desc" ? "Desc" : ""}
                        </span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className={styles.empty}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
