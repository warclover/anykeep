/**
 * 表格类型内容
 */

import { memo } from "react";
import { DefaultContent } from "./default-content";

export const TableContent = memo(function TableContent({
  content,
}: {
  content: unknown;
}) {
  if (!Array.isArray(content) || content.length === 0) {
    return <DefaultContent content={content} />;
  }

  const firstRow = content[0];
  if (typeof firstRow !== "object" || firstRow === null) {
    return <DefaultContent content={content} />;
  }

  const headers = Object.keys(firstRow as Record<string, unknown>);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-purple-100">
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2 text-left font-medium text-gray-700 bg-purple-50/50"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-100 hover:bg-purple-50/30"
            >
              {headers.map((header) => (
                <td key={header} className="px-3 py-2 text-gray-600">
                  {String((row as Record<string, unknown>)[header] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
