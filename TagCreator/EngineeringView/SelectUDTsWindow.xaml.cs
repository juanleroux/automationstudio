using System.Collections.Generic;
using System.Linq;
using System.Windows;

namespace TagCreator
{
	public class SelectableUDT
	{
		public string Name { get; set; }
		public bool IsSelected { get; set; } = false;
	}

	public partial class SelectUDTsWindow : Window
	{
		public List<SelectableUDT> UDTs { get; private set; }

		public SelectUDTsWindow(List<string> udtNames)
		{
			InitializeComponent();

			// Wrap names into SelectableUDT objects (all unchecked by default)
			UDTs = udtNames.Select(n => new SelectableUDT { Name = n }).ToList();

			UDTsItemsControl.ItemsSource = UDTs;
		}

		private void SelectAllButton_Click(object sender, RoutedEventArgs e)
		{
			bool allSelected = UDTs.All(u => u.IsSelected);
			foreach (var udt in UDTs)
				udt.IsSelected = !allSelected;

			// Refresh UI
			UDTsItemsControl.Items.Refresh();
		}

		private void ImportButton_Click(object sender, RoutedEventArgs e)
		{
			this.DialogResult = true; // indicate OK
			this.Close();
		}

		private void CancelButton_Click(object sender, RoutedEventArgs e)
		{
			this.DialogResult = false; // indicate cancel
			this.Close();
		}

		public List<string> GetSelectedUDTs()
		{
			return UDTs.Where(u => u.IsSelected).Select(u => u.Name).ToList();
		}
	}
}
