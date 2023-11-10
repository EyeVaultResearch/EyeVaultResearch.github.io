$(document).ready(function () {
        // Enable sorting on click
        $('th').click(function () {
            var table = $('#sortable-table');
            var index = $(this).index();

            // Get the tbody rows and sort them based on the clicked column
            var rows = table.find('tbody > tr').get().sort(function (a, b) {
                var A = $(a).children('td').eq(index).text().toUpperCase();
                var B = $(b).children('td').eq(index).text().toUpperCase();

                if (A < B) {
                    return -1;
                }

                if (A > B) {
                    return 1;
                }

                return 0;
            });

            // Append the sorted rows to the table
            $.each(rows, function (index, row) {
                table.children('tbody').append(row);
            });
        });
    });