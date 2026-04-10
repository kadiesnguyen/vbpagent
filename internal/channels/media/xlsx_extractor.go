package media

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
)

// xlsxMaxCells is the max number of cells to extract across all sheets.
const xlsxMaxCells = 50_000

// extractXLSX parses an .xlsx file and returns its content as markdown tables.
// Uses only stdlib (archive/zip + encoding/xml) — xlsx is a zip of XML files.
func extractXLSX(data []byte) (string, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("open xlsx: %w", err)
	}

	// Index files by name for quick access.
	files := make(map[string]*zip.File, len(r.File))
	for _, f := range r.File {
		files[f.Name] = f
	}

	// 1. Parse shared strings table.
	sharedStrings, err := parseSharedStrings(files)
	if err != nil {
		return "", fmt.Errorf("parse shared strings: %w", err)
	}

	// 2. Parse workbook for sheet names and IDs.
	sheets, err := parseWorkbookSheets(files)
	if err != nil {
		return "", fmt.Errorf("parse workbook: %w", err)
	}

	var sb strings.Builder
	totalCells := 0

	for i, sheet := range sheets {
		if totalCells >= xlsxMaxCells {
			sb.WriteString("\n... [remaining sheets truncated]\n")
			break
		}
		sheetPath := fmt.Sprintf("xl/worksheets/sheet%d.xml", i+1)

		rows, err := parseSheetRows(files, sheetPath, sharedStrings)
		if err != nil {
			sb.WriteString(fmt.Sprintf("### Sheet: %s\n[Error reading sheet: %v]\n\n", sheet, err))
			continue
		}
		if len(rows) == 0 {
			continue
		}

		sb.WriteString(fmt.Sprintf("### Sheet: %s\n\n", sheet))

		// Determine max column count.
		maxCols := 0
		for _, row := range rows {
			if len(row) > maxCols {
				maxCols = len(row)
			}
		}

		// Render as markdown table (first row = header).
		for rowIdx, row := range rows {
			// Pad row to maxCols.
			for len(row) < maxCols {
				row = append(row, "")
			}
			sb.WriteString("| ")
			sb.WriteString(strings.Join(escapeTableCells(row), " | "))
			sb.WriteString(" |\n")
			if rowIdx == 0 {
				// Separator after header.
				sb.WriteString("|")
				for range row {
					sb.WriteString("---|")
				}
				sb.WriteString("\n")
			}
			totalCells += len(row)
			if totalCells >= xlsxMaxCells {
				sb.WriteString("\n... [sheet truncated]\n")
				break
			}
		}
		sb.WriteString("\n")
	}

	return sb.String(), nil
}

func escapeTableCells(cells []string) []string {
	out := make([]string, len(cells))
	for i, c := range cells {
		// Replace pipe and newlines to keep table valid.
		c = strings.ReplaceAll(c, "|", "\\|")
		c = strings.ReplaceAll(c, "\n", " ")
		c = strings.ReplaceAll(c, "\r", "")
		if c == "" {
			c = " "
		}
		out[i] = c
	}
	return out
}

// parseSharedStrings reads xl/sharedStrings.xml and returns a slice of strings.
func parseSharedStrings(files map[string]*zip.File) ([]string, error) {
	f, ok := files["xl/sharedStrings.xml"]
	if !ok {
		return nil, nil // No shared strings is valid (all values are inline).
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	type tElement struct {
		Value string `xml:",chardata"`
	}
	type rElement struct {
		T tElement `xml:"t"`
	}
	type si struct {
		T  tElement  `xml:"t"`
		Rs []rElement `xml:"r"`
	}
	type sst struct {
		Items []si `xml:"si"`
	}

	var s sst
	if err := xml.NewDecoder(rc).Decode(&s); err != nil {
		return nil, err
	}

	result := make([]string, len(s.Items))
	for i, item := range s.Items {
		if len(item.Rs) > 0 {
			// Rich text: concatenate all run fragments.
			var parts []string
			for _, r := range item.Rs {
				parts = append(parts, r.T.Value)
			}
			result[i] = strings.Join(parts, "")
		} else {
			result[i] = item.T.Value
		}
	}
	return result, nil
}

// parseWorkbookSheets reads xl/workbook.xml and returns ordered sheet names.
func parseWorkbookSheets(files map[string]*zip.File) ([]string, error) {
	f, ok := files["xl/workbook.xml"]
	if !ok {
		return []string{"Sheet1"}, nil
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	type sheet struct {
		Name string `xml:"name,attr"`
	}
	type workbook struct {
		Sheets []sheet `xml:"sheets>sheet"`
	}

	var wb workbook
	if err := xml.NewDecoder(rc).Decode(&wb); err != nil {
		return nil, err
	}

	names := make([]string, len(wb.Sheets))
	for i, s := range wb.Sheets {
		names[i] = s.Name
	}
	return names, nil
}

// parseSheetRows reads a worksheet XML and returns rows of string values.
func parseSheetRows(files map[string]*zip.File, path string, sharedStrings []string) ([][]string, error) {
	f, ok := files[path]
	if !ok {
		return nil, nil
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	type cellXML struct {
		R  string `xml:"r,attr"`  // cell reference e.g. "A1"
		T  string `xml:"t,attr"`  // type: s=sharedString, str=string, n=number, b=bool, inlineStr, e=error
		V  string `xml:"v"`       // value (index for shared strings, raw for numbers)
		Is struct {
			T string `xml:"t"`
		} `xml:"is"`
	}
	type rowXML struct {
		R     int       `xml:"r,attr"`
		Cells []cellXML `xml:"c"`
	}
	type sheetData struct {
		Rows []rowXML `xml:"sheetData>row"`
	}

	var sd sheetData
	if err := xml.NewDecoder(rc).Decode(&sd); err != nil {
		return nil, err
	}

	var rows [][]string
	for _, row := range sd.Rows {
		// Determine max column index in this row.
		maxCol := 0
		for _, c := range row.Cells {
			col := colIndex(c.R)
			if col > maxCol {
				maxCol = col
			}
		}

		rowCells := make([]string, maxCol+1)
		for _, c := range row.Cells {
			col := colIndex(c.R)
			if col < 0 || col >= len(rowCells) {
				continue
			}
			switch c.T {
			case "s":
				idx, err := strconv.Atoi(c.V)
				if err == nil && idx >= 0 && idx < len(sharedStrings) {
					rowCells[col] = sharedStrings[idx]
				}
			case "inlineStr":
				rowCells[col] = c.Is.T
			case "b":
				if c.V == "1" {
					rowCells[col] = "TRUE"
				} else {
					rowCells[col] = "FALSE"
				}
			case "e":
				rowCells[col] = "#ERR"
			default:
				rowCells[col] = c.V
			}
		}

		// Trim trailing empty cells.
		trimmed := rowCells
		for len(trimmed) > 0 && trimmed[len(trimmed)-1] == "" {
			trimmed = trimmed[:len(trimmed)-1]
		}
		if len(trimmed) > 0 {
			rows = append(rows, trimmed)
		}
	}
	return rows, nil
}

// colIndex converts a cell reference like "A1", "B3", "AA5" to a 0-based column index.
func colIndex(ref string) int {
	col := 0
	for _, ch := range ref {
		if ch >= 'A' && ch <= 'Z' {
			col = col*26 + int(ch-'A'+1)
		} else {
			break
		}
	}
	return col - 1
}
